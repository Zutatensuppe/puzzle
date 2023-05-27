import Db, { WhereRaw } from '../Db'

const TABLE = 'announcements'

export interface AnnouncementsRow {
  id: number
  created: Date
  title: string
  message: string
}

export class AnnouncementsRepo {
  constructor(private readonly db: Db) {
    // pass
  }

  async getAll(): Promise<AnnouncementsRow[]> {
    return await this.db.getMany(TABLE, undefined, [{ created: -1 }])
  }

  async insert(announcement: Partial<AnnouncementsRow>): Promise<number> {
    return await this.db.insert(TABLE, announcement, 'id') as number
  }

  async get(where: WhereRaw): Promise<AnnouncementsRow | null> {
    return await this.db.get('announcements', where)
  }
}
