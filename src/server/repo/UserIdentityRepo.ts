import Crypto from '../Crypto'
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
    if (userIdentity.provider_email) {
      userIdentity.provider_email = Crypto.encrypt(userIdentity.provider_email)
    }
    return await this.db.insert(TABLE, userIdentity, 'id') as number
  }

  async get(where: WhereRaw): Promise<IdentityRow | null> {
    if (where.provider_email) {
      where.provider_email = Crypto.encrypt(where.provider_email)
    }
    const identity = await this.db.get(TABLE, where)
    if (identity) {
      if (identity.provider_email) {
        identity.provider_email = Crypto.decrypt(identity.provider_email)
      }
    }
    return identity
  }

  async update(userIdentity: IdentityRow): Promise<void> {
    if (userIdentity.provider_email) {
      userIdentity.provider_email = Crypto.encrypt(userIdentity.provider_email)
    }
    await this.db.update(TABLE, userIdentity, { id: userIdentity.id })
  }
}
