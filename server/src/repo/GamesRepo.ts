import { EncodedPlayerIdx } from '@common/Types'
import type { EncodedPlayer, GameId, GameRow, GameRowWithImageAndUser, UserId , UserRow } from '@common/Types'
import type Db from '../lib/Db'
import type { Repos } from './Repos'
import DbData from '../app/DbData'

export class GamesRepo {
  constructor(
    private readonly db: Db,
    private readonly repos: Repos,
  ) {
    // pass
  }

  async count(): Promise<number> {
    return await this.db.count(DbData.Tables.Games)
  }

  async getAll(offset: number, limit: number): Promise<GameRow[]> {
    return await this.db.getMany(DbData.Tables.Games, undefined, [{ created: -1 }], { offset, limit })
  }

  async getAllWithImagesAndUsers(offset: number, limit: number): Promise<GameRowWithImageAndUser[]> {
    const items = await this.getAll(offset, limit)

    const imageIds = items.map(item => item.image_id).filter(id => !!id)
    const images = await this.repos.images.getManyByIds(imageIds)

    const userIds = items.map(item => item.creator_user_id).filter(id => !!id) as UserId[]
    const users = await this.repos.users.getManyByIds(userIds)

    const gamesWithImagesAndUsers: GameRowWithImageAndUser[] = items.map(game => {
      return Object.assign({}, game, {
        image: images.find(image => image.id === game.image_id) || null,
        user: users.find(user => user.id === game.creator_user_id) || null,
      })
    })
    return gamesWithImagesAndUsers
  }

  async getGameRowById(gameId: GameId): Promise<GameRow | null> {
    const gameRow = await this.db.get(DbData.Tables.Games, {id: gameId})
    return (gameRow as GameRow) || null
  }

  async getPublicRunningGames(
    offset: number,
    limit: number,
    currentUserId: UserId,
    limitByUserId: UserId | null,
  ): Promise<GameRow[]> {
    const limitSql = this.db._buildLimit({ limit, offset })

    if (limitByUserId) {
      // pieces count only is misleading because the user can help
      // in the puzzle without connecting a piece
      return await this.db._getMany(`
        SELECT g.* FROM ${DbData.Tables.Games} g
        INNER JOIN ${DbData.Tables.UserXGame} uxg on uxg.game_id = g.id
        WHERE
          (g."private" = 0 OR g.creator_user_id = $1)
          AND
          uxg.user_id = $2
          AND
          uxg.pieces_count > 0
          AND
          (g.finished is null)
        ORDER BY
          g.created DESC
        ${limitSql}
      `, [currentUserId, limitByUserId]) as GameRow[]
    }

    return await this.db._getMany(`
      SELECT g.* FROM ${DbData.Tables.Games} g
      WHERE
        (g."private" = 0 OR g.creator_user_id = $1)
        AND
        (g.finished is null)
      ORDER BY
        g.created DESC
      ${limitSql}
    `, [currentUserId]) as GameRow[]
  }

  async getPublicFinishedGames(
    offset: number,
    limit: number,
    currentUserId: UserId,
    limitByUserId: UserId | null,
  ): Promise<GameRow[]> {
    const limitSql = this.db._buildLimit({ limit, offset })

    if (limitByUserId) {
      // pieces count only is misleading because the user can help
      // in the puzzle without connecting a piece
      return await this.db._getMany(`
        SELECT g.* FROM ${DbData.Tables.Games} g
        INNER JOIN ${DbData.Tables.UserXGame} uxg on uxg.game_id = g.id
        WHERE
          (g."private" = 0 OR g.creator_user_id = $1)
          AND
          uxg.user_id = $2
          AND
          uxg.pieces_count > 0
          AND
          (g.finished is not null)
        ORDER BY
          g.finished DESC
        ${limitSql}
      `, [currentUserId, limitByUserId]) as GameRow[]
    }

    return await this.db._getMany(`
      SELECT * FROM ${DbData.Tables.Games}
      WHERE
        ("private" = 0 OR creator_user_id = $1)
        AND
        (finished is not null)
      ORDER BY
        finished DESC
      ${limitSql}
    `, [currentUserId]) as GameRow[]
  }

  async countPublicRunningGames(userId: UserId): Promise<number> {
    const sql = `SELECT COUNT(*)::int AS count FROM ${DbData.Tables.Games} WHERE
      ("private" = 0 OR creator_user_id = $1)
      AND
      (finished is null)
    `
    const row = await this.db._get<{ count: number }>(sql, [userId])
    return row?.count ?? 0
  }

  async countPublicFinishedGames(userId: UserId): Promise<number> {
    const sql = `SELECT COUNT(*)::int AS count FROM ${DbData.Tables.Games} WHERE
      ("private" = 0 OR creator_user_id = $1)
      AND
      (finished is not null)
    `
    const row = await this.db._get<{ count: number }>(sql, [userId])
    return row?.count ?? 0
  }

  async countGamesByUser(
    currentUserId: UserId,
    limitToUserId: UserId,
  ): Promise<number> {
    // pieces count only is misleading because the user can help
    // in the puzzle without connecting a piece
    const sql = `
      SELECT
        COUNT(*)::int AS count
      FROM
        ${DbData.Tables.UserXGame} uxg
      INNER JOIN
        ${DbData.Tables.Games} g ON g.id = uxg.game_id
      WHERE
        (g.private = 0 OR uxg.user_id = $1)
      AND
        uxg.user_id = $2
      AND
        uxg.pieces_count > 0`
    const row = await this.db._get<{ count: number }>(sql, [currentUserId, limitToUserId])
    return row?.count ?? 0
  }

  async countGamePiecesByUser(
    currentUserId: UserId,
    limitToUserId: UserId,
  ): Promise<number> {
    // pieces count only is misleading because the user can help
    // in the puzzle without connecting a piece
    const sql = `
      SELECT
        SUM(uxg.pieces_count)::int AS count
      FROM
        ${DbData.Tables.UserXGame} uxg
      INNER JOIN
        ${DbData.Tables.Games} g ON g.id = uxg.game_id
      WHERE
        (g.private = 0 OR uxg.user_id = $1)
      AND
        uxg.user_id = $2`
    const row = await this.db._get<{ count: number }>(sql, [currentUserId, limitToUserId])
    return row?.count ?? 0
  }

  async exists(gameId: GameId): Promise<boolean> {
    const gameRow = await this.getGameRowById(gameId)
    return !!gameRow
  }

  async upsert(row: Omit<GameRow, 'image_snapshot_url' | 'reported'>): Promise<void> {
    await this.db.upsert(DbData.Tables.Games, row, ['id'])
  }

  async updatePlayerRelations(gameId: GameId, players: EncodedPlayer[]): Promise<void> {
    if (!players.length) {
      return
    }
    const userRows = await this.db.getMany<UserRow>(DbData.Tables.Users, { client_id: { '$in': players.map(p => p[EncodedPlayerIdx.ID] )}})
    for (const p of players) {
      const userRow = userRows.find(row => row.client_id === p[EncodedPlayerIdx.ID])
      const userId = userRow
        ? userRow.id
        : await this.db.insert(DbData.Tables.Users, { client_id: p[EncodedPlayerIdx.ID], created: new Date() }, 'id')

      await this.db.upsert(DbData.Tables.UserXGame, {
        user_id: userId,
        game_id: gameId,
        pieces_count: p[EncodedPlayerIdx.POINTS],
      }, ['user_id', 'game_id'])
    }
  }

  async delete(gameId: GameId): Promise<void> {
    await this.db.delete(DbData.Tables.Games, { id: gameId })
    await this.db.delete(DbData.Tables.UserXGame, { game_id: gameId })

    await this.repos.leaderboard.updateLeaderboards()
  }

  async reportGame(gameId: GameId): Promise<void> {
    await this.db.run(`UPDATE ${DbData.Tables.Games} SET reported = reported + 1 WHERE id = $1`, [gameId])
  }
}
