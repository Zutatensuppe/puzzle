import Db, { WhereRaw } from '../Db'
import { LivestreamId } from '../../../common/src/Types'

const TABLE = 'twitch_livestreams'

export interface LivestreamsRow {
  id: number
  is_live: number
  livestream_id: LivestreamId
  title: string
  url: string
  user_display_name: string
  user_thumbnail: string
  language: string
  viewers: number
}

export class LivestreamsRepo {
  constructor(
    private readonly db: Db,
  ) {
    // pass
  }

  async getLive(): Promise<LivestreamsRow[]> {
    return await this.db.getMany(TABLE, { is_live: 1 })
  }

  async insertMany(livestreams: (Omit<LivestreamsRow, 'id'>)[]): Promise<void> {
    await this.db.insertMany(TABLE, livestreams)
  }

  async update(livestream: Partial<LivestreamsRow>, where: WhereRaw): Promise<void> {
    await this.db.update(TABLE, livestream, where)
  }
}
