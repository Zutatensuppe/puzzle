import Db, { WhereRaw } from '../Db'
import { AnnouncementId, AnnouncementsRow } from '../../../common/src/Types'
import { Repos } from './Repos'

const TABLE = 'announcements'

export class AnnouncementsRepo {
  constructor(
    private readonly db: Db,
    private readonly repos: Repos,
  ) {
    // pass
  }

  async getAll(): Promise<AnnouncementsRow[]> {
    return await this.db.getMany(TABLE, undefined, [{ created: -1 }])
  }

  async insert(announcement: Omit<AnnouncementsRow, 'id'>): Promise<AnnouncementId> {
    return await this.db.insert(TABLE, announcement, 'id') as AnnouncementId
  }

  async get(where: WhereRaw): Promise<AnnouncementsRow | null> {
    return await this.db.get('announcements', where)
  }
}
