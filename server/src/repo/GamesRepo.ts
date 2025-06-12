import { EncodedPlayerIdx } from '../../../common/src/Types'
import type { EncodedPlayer, GameId, GameRow, GameRowWithImageAndUser, UserId } from '../../../common/src/Types'
import type Db from '../Db'
import type { Repos } from './Repos'

const TABLE = 'games'

export class GamesRepo {
  constructor(
    private readonly db: Db,
    private readonly repos: Repos,
  ) {
    // pass
  }

  async count(): Promise<number> {
    return await this.db.count(TABLE)
  }

  async getAll(offset: number, limit: number): Promise<GameRow[]> {
    return await this.db.getMany(TABLE, undefined, [{ created: -1 }], { offset, limit })
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
    const gameRow = await this.db.get(TABLE, {id: gameId})
    return (gameRow as GameRow) || null
  }

  async getPublicRunningGames(offset: number, limit: number, userId: UserId): Promise<GameRow[]> {
    const limitSql = this.db._buildLimit({ limit, offset })
    return await this.db._getMany(`
      SELECT * FROM ${TABLE}
      WHERE
        ("private" = 0 OR creator_user_id = $1)
        AND
        (finished is null)
      ORDER BY
        created DESC
      ${limitSql}
    `, [userId]) as GameRow[]
  }

  async getPublicFinishedGames(offset: number, limit: number, userId: UserId): Promise<GameRow[]> {
    const limitSql = this.db._buildLimit({ limit, offset })
    return await this.db._getMany(`
      SELECT * FROM ${TABLE}
      WHERE
        ("private" = 0 OR creator_user_id = $1)
        AND
        (finished is not null)
      ORDER BY
        finished DESC
      ${limitSql}
    `, [userId]) as GameRow[]
  }

  async countPublicRunningGames(userId: UserId): Promise<number> {
    const sql = `SELECT COUNT(*)::int FROM ${TABLE} WHERE
      ("private" = 0 OR creator_user_id = $1)
      AND
      (finished is null)
    `
    const row = await this.db._get(sql, [userId])
    return row.count
  }

  async countPublicFinishedGames(userId: UserId): Promise<number> {
    const sql = `SELECT COUNT(*)::int FROM ${TABLE} WHERE
      ("private" = 0 OR creator_user_id = $1)
      AND
      (finished is not null)
    `
    const row = await this.db._get(sql, [userId])
    return row.count
  }

  async exists(gameId: GameId): Promise<boolean> {
    const gameRow = await this.getGameRowById(gameId)
    return !!gameRow
  }

  async upsert(row: Omit<GameRow, 'image_snapshot_url' | 'reported'>): Promise<void> {
    await this.db.upsert(TABLE, row, ['id'])
  }

  async updatePlayerRelations(gameId: GameId, players: EncodedPlayer[]): Promise<void> {
    if (!players.length) {
      return
    }
    const userRows = await this.db.getMany('users', { client_id: { '$in': players.map(p => p[EncodedPlayerIdx.ID] )}})
    for (const p of players) {
      const userRow = userRows.find(row => row.client_id === p[EncodedPlayerIdx.ID])
      const userId = userRow
        ? userRow.id
        : await this.db.insert('users', { client_id: p[EncodedPlayerIdx.ID], created: new Date() }, 'id')

      await this.db.upsert('user_x_game', {
        user_id: userId,
        game_id: gameId,
        pieces_count: p[EncodedPlayerIdx.POINTS],
      }, ['user_id', 'game_id'])
    }
  }

  async delete(gameId: GameId): Promise<void> {
    await this.db.delete(TABLE, { id: gameId })
    await this.db.delete('user_x_game', { game_id: gameId })

    await this.repos.leaderboard.updateLeaderboards()
  }

  async reportGame(gameId: GameId): Promise<void> {
    await this.db.run(`UPDATE ${TABLE} SET reported = reported + 1 WHERE id = $1`, [gameId])
  }
}
