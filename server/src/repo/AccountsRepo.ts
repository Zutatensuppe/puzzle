import Crypto from '../Crypto'
import Db, { WhereRaw } from '../Db'
import { AccountId } from '../../../common/src/Types'

const TABLE = 'accounts'

export interface AccountRow {
  id: AccountId
  created: Date
  email: string
  password: string
  salt: string
  status: 'verified' | 'verification_pending'
}

export class AccountsRepo {
  constructor(
    private readonly db: Db,
  ) {
    // pass
  }

  async insert(account: Partial<AccountRow>): Promise<AccountId> {
    if (account.email) {
      account.email = Crypto.encrypt(account.email)
    }
    return await this.db.insert(TABLE, account, 'id') as AccountId
  }

  async get(where: WhereRaw): Promise<AccountRow | null> {
    if (where.email) {
      where.email = Crypto.encrypt(where.email)
    }
    const account = await this.db.get(TABLE, where)
    if (account) {
      if (account.email) {
        account.email = Crypto.decrypt(account.email)
      }
    }
    return account
  }

  async update(account: Partial<AccountRow>, where: WhereRaw): Promise<void> {
    if (account.email) {
      account.email = Crypto.encrypt(account.email)
    }
    if (where.email) {
      where.email = Crypto.encrypt(where.email)
    }
    await this.db.update('accounts', account, where)
  }
}
