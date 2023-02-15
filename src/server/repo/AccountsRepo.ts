import Db, { WhereRaw } from '../Db'

const TABLE = 'accounts'

export interface AccountRow {
  id: number
  created: Date
  email: string
  password: string
  salt: string
  status: 'verified' | 'verification_pending'
}

export class AccountsRepo {
  constructor(private readonly db: Db) {
    // pass
  }

  async insert(account: Partial<AccountRow>): Promise<number> {
    return await this.db.insert(TABLE, account, 'id') as number
  }

  async get(where: WhereRaw): Promise<AccountRow | null> {
    return await this.db.get(TABLE, where)
  }

  async update(account: Partial<AccountRow>, where: WhereRaw): Promise<void> {
    await this.db.update('accounts', account, where)
  }
}
