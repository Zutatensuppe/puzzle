import type { LivestreamsRow } from '@common/Types'
import DbData from '../app/DbData'
import type Db from '../lib/Db'
import type { WhereRaw } from '../lib/Db'

export class LivestreamsRepo {
  constructor(
    private readonly db: Db,
  ) {
    // pass
  }

  async getLive(): Promise<LivestreamsRow[]> {
    return await this.db.getMany(DbData.Tables.TwitchLivestreams, { is_live: 1 })
  }

  async insertMany(livestreams: (Omit<LivestreamsRow, 'id'>)[]): Promise<void> {
    await this.db.insertMany(DbData.Tables.TwitchLivestreams, livestreams)
  }

  async update(livestream: Partial<LivestreamsRow>, where: WhereRaw): Promise<void> {
    await this.db.update(DbData.Tables.TwitchLivestreams, livestream, where)
  }
}
