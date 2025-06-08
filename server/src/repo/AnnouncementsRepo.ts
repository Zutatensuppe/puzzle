import Db, { WhereRaw } from '../Db'
import { Announcement, AnnouncementId } from '../../../common/src/Types'

const TABLE = 'announcements'

export class AnnouncementsRepo {
  constructor(
    private readonly db: Db,
  ) {
    // pass
  }

  async getAll(): Promise<Announcement[]> {
    return await this.db.getMany(TABLE, undefined, [{ created: -1 }])
  }

  async insert(announcement: Omit<Announcement, 'id'>): Promise<AnnouncementId> {
    return await this.db.insert(TABLE, announcement, 'id') as AnnouncementId
  }

  async get(where: WhereRaw): Promise<Announcement | null> {
    return await this.db.get('announcements', where)
  }
}
