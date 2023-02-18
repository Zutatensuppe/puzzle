import { EncodedPlayer } from '../../common/Types'
import Util from '../../common/Util'
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
