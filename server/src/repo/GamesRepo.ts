import { EncodedPlayer } from '../../../common/src/Types'
import Util from '../../../common/src/Util'
import Db, { WhereRaw } from '../Db'

const TABLE = 'games'

export interface GameRow {
  id: string
  creator_user_id: number | null
  image_id: number
  created: Date
  finished: Date | null
  data: string
  private: number
  pieces_count: number
  image_snapshot_url: string | null
}

export class GamesRepo {
  constructor(private readonly db: Db) {
    // pass
  }

  async getGameRowById(gameId: string): Promise<GameRow | null> {
    const gameRow = await this.db.get(TABLE, {id: gameId})
    return (gameRow as GameRow) || null
  }

  async getPublicRunningGames(offset: number, limit: number, userId: number): Promise<GameRow[]> {
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

  async getPublicFinishedGames(offset: number, limit: number, userId: number): Promise<GameRow[]> {
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

  async countPublicRunningGames(userId: number): Promise<number> {
    const sql = `SELECT COUNT(*)::int FROM ${TABLE} WHERE
      ("private" = 0 OR creator_user_id = $1)
      AND
      (finished is null)
    `
    const row = await this.db._get(sql, [userId])
    return row.count
  }

  async countPublicFinishedGames(userId: number): Promise<number> {
    const sql = `SELECT COUNT(*)::int FROM ${TABLE} WHERE
      ("private" = 0 OR creator_user_id = $1)
      AND
      (finished is not null)
    `
    const row = await this.db._get(sql, [userId])
    return row.count
  }

  async exists(gameId: string): Promise<boolean> {
    const gameRow = await this.getGameRowById(gameId)
    return !!gameRow
  }

  async upsert(row: Partial<GameRow>, where: WhereRaw): Promise<void> {
    await this.db.upsert(TABLE, row, where)
  }

  async updatePlayerRelations(gameId: string, players: EncodedPlayer[]): Promise<void> {
    if (!players.length) {
      return
    }
    const decodedPlayers = players.map(player => Util.decodePlayer(player))
    const userRows = await this.db.getMany('users', { client_id: { '$in': decodedPlayers.map(p => p.id )}})
    for (const p of decodedPlayers) {
      const userRow = userRows.find(row => row.client_id === p.id)
      const userId = userRow
        ? userRow.id
        : await this.db.insert('users', { client_id: p.id, created: new Date() }, 'id')

      await this.db.upsert('user_x_game', {
        user_id: userId,
        game_id: gameId,
        pieces_count: p.points,
      }, {
        user_id: userId,
        game_id: gameId,
      })
    }
  }
}
