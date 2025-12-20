import DbData from '../app/DbData'
import type Db from '../lib/Db'
import type { WhereRaw } from '../lib/Db'
import type { TokenRow } from '@common/Types'

export class TokensRepo {
  constructor(
    private readonly db: Db,
  ) {
    // pass
  }

  async insert(row: TokenRow): Promise<void> {
    await this.db.insert(DbData.Tables.Tokens, row)
  }

  async get(where: WhereRaw): Promise<TokenRow | null> {
    return await this.db.get(DbData.Tables.Tokens, where)
  }

  async delete(where: WhereRaw): Promise<void> {
    await this.db.delete(DbData.Tables.Tokens, where)
  }
}
