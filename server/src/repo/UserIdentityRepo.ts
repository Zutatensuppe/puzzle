import DbData from '../app/DbData'
import Crypto from '../Crypto'
import type Db from '../lib/Db'
import type { WhereRaw } from '../lib/Db'
import type { IdentityId, UserId } from '@common/Types'

export interface IdentityRow {
  id: IdentityId
  user_id: UserId
  provider_name: string
  provider_id: string
  provider_email: string | null
}

export class UserIdentityRepo {
  constructor(
    private readonly db: Db,
  ) {
    // pass
  }

  async insert(userIdentity: Omit<IdentityRow, 'id'>): Promise<IdentityId> {
    if (userIdentity.provider_email) {
      userIdentity.provider_email = Crypto.encrypt(userIdentity.provider_email)
    }
    return await this.db.insert(DbData.Tables.UserIdentity, userIdentity, 'id') as IdentityId
  }

  async get(where: WhereRaw): Promise<IdentityRow | null> {
    if (where.provider_email) {
      where.provider_email = Crypto.encrypt(where.provider_email)
    }
    const identity = await this.db.get<IdentityRow>(DbData.Tables.UserIdentity, where)
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
    await this.db.update(DbData.Tables.UserIdentity, userIdentity, { id: userIdentity.id })
  }
}
