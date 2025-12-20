import DbData from '../app/DbData'
import type Db from '../lib/Db'
import type { WhereRaw } from '../lib/Db'
import type { Announcement, AnnouncementId } from '@common/Types'

export class AnnouncementsRepo {
  constructor(
    private readonly db: Db,
  ) {
    // pass
  }

  async getAll(): Promise<Announcement[]> {
    return await this.db.getMany(DbData.Tables.Announcements, undefined, [{ created: -1 }])
  }

  async insert(announcement: Omit<Announcement, 'id'>): Promise<AnnouncementId> {
    return await this.db.insert(DbData.Tables.Announcements, announcement, 'id') as AnnouncementId
  }

  async get(where: WhereRaw): Promise<Announcement | null> {
    return await this.db.get(DbData.Tables.Announcements, where)
  }
}
