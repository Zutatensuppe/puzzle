import Db, { WhereRaw } from '../Db'

const TABLE = 'user_identity'

export interface IdentityRow {
  id: number
  user_id: number
  provider_name: string
  provider_id: string
  provider_email: string
}

export class UserIdentityRepo {
  constructor(private readonly db: Db) {
    // pass
  }

  async insert(userIdentity: Partial<IdentityRow>): Promise<number> {
    return await this.db.insert(TABLE, userIdentity, 'id') as number
  }

  async get(where: WhereRaw): Promise<IdentityRow | null> {
    return await this.db.get(TABLE, where)
  }

  async update(userIdentity: IdentityRow): Promise<void> {
    await this.db.update(TABLE, userIdentity, { id: userIdentity.id })
  }
}
