import { TokenRow } from '../../../common/src/Types'
import Db, { WhereRaw } from '../Db'
import { Repos } from './Repos'

const TABLE = 'tokens'

export class TokensRepo {
  constructor(
    private readonly db: Db,
    private readonly repos: Repos,
  ) {
    // pass
  }

  async insert(row: TokenRow): Promise<void> {
    await this.db.insert(TABLE, row)
  }

  async get(where: WhereRaw): Promise<TokenRow> {
    return await this.db.get(TABLE, where)
  }

  async delete(where: WhereRaw): Promise<void> {
    await this.db.delete('tokens', where)
  }
}
