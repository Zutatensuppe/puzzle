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
}

export class GamesRepo {
  constructor(private readonly db: Db) {
    // pass
  }

  async getGameRowById(gameId: string): Promise<GameRow | null> {
    const gameRow = await this.db.get(TABLE, {id: gameId})
    return (gameRow as GameRow) || null
  }

  async getPublicRunningGames(offset: number, limit: number): Promise<GameRow[]> {
    return await this.db.getMany(
      TABLE,
      { private: 0, finished: null },
      [{ created: -1 }],
      { limit, offset }
    ) as GameRow[]
  }

  async getPublicFinishedGames(offset: number, limit: number): Promise<GameRow[]> {
    return await this.db.getMany(
      TABLE,
      { private: 0, finished: { '$ne': null } },
      [{ finished: -1 }],
      { limit, offset }
    ) as GameRow[]
  }

  async countPublicRunningGames(): Promise<number> {
    return await this.count({ private: 0, finished: null })
  }

  async countPublicFinishedGames(): Promise<number> {
    return await this.count({ private: 0, finished: { '$ne': null } })
  }

  async count(where: WhereRaw): Promise<number> {
    return await this.db.count(TABLE, where)
  }

  async exists(gameId: string): Promise<boolean> {
    const gameRow = await this.getGameRowById(gameId)
    return !!gameRow
  }

  async upsert(row: GameRow, where: WhereRaw): Promise<void> {
    await this.db.upsert(TABLE, row, where)
  }
}
