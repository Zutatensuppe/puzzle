import { AccountId, ClientId, TokenRow, UserId } from '../../common/src/Types'
import { COOKIE_TOKEN, generateToken } from './Auth'
import Db, { WhereRaw } from './Db'
import { AccountRow } from './repo/AccountsRepo'
import { Repos } from './repo/Repos'
import { IdentityRow } from './repo/UserIdentityRepo'
import { UserGroupRow, UserRow } from './repo/UsersRepo'

const HEADER_CLIENT_ID = 'client-id'

interface UserInfo {
  token: string | null,
  user: UserRow | null,
  user_type: 'guest' | 'user' | null,
}

export class Users {
  constructor(
    private db: Db,
    private repos: Repos,
  ) {
  }

  async usernameTaken(username: string): Promise<boolean> {
    const row = await this.db._get(`
      with relevant_users as (
        select u.name from users u
          inner join user_identity ui on ui.user_id = u.id and ui.provider_name = 'local'
          inner join accounts a on a.id::text = ui.provider_id and a.status = 'verified'
        union
        select u.name from users u
          inner join user_identity ui on ui.user_id = u.id and ui.provider_name = 'twitch'
      )
      select * from relevant_users where name = $1 limit 1
    `, [username])
    return row !== null
  }

  async clientIdTaken(clientId: ClientId): Promise<boolean> {
    const row = await this.db._get(`
      with relevant_users as (
        select u.client_id from users u
          inner join user_identity ui on ui.user_id = u.id and ui.provider_name = 'local'
          inner join accounts a on a.id::text = ui.provider_id and a.status = 'verified'
        union
        select u.client_id from users u
          inner join user_identity ui on ui.user_id = u.id and ui.provider_name = 'twitch'
      )
      select * from relevant_users where client_id = $1 limit 1
    `, [clientId])
    return row !== null
  }

  async emailTaken(emailPlain: string): Promise<boolean> {
    return await this.getAccountByEmailPlain(emailPlain) !== null
  }

  async setAccountVerified(accountId: AccountId): Promise<void> {
    await this.repos.accounts.update({ status: 'verified'}, { id: accountId})
  }

  async getGroups(userId: UserId): Promise<UserGroupRow[]> {
    return await this.repos.users.getGroupsByUserId(userId)
  }

  async createAccount(account: any): Promise<AccountRow> {
    const accountId = await this.repos.accounts.insert(account)
    return await this.repos.accounts.get({ id: accountId }) as AccountRow
  }

  async createIdentity(identity: Omit<IdentityRow, 'id'>): Promise<IdentityRow> {
    const identityId = await this.repos.userIdentity.insert(identity)
    return await this.repos.userIdentity.get({ id: identityId }) as IdentityRow
  }

  async updateIdentity(identity: any): Promise<void> {
    await this.repos.userIdentity.update(identity)
  }

  async getIdentity(where: WhereRaw): Promise<IdentityRow | null> {
    return await this.repos.userIdentity.get(where)
  }

  async getAccountByEmailPlain(emailPlain: string): Promise<AccountRow | null> {
    return await this.getAccount({ email: emailPlain })
  }

  async getAccount(where: WhereRaw): Promise<AccountRow | null> {
    return await this.repos.accounts.get(where)
  }

  async updateAccount(account: AccountRow): Promise<void> {
    return await this.repos.accounts.update(account, { id: account.id })
  }

  async createUser(user: Omit<UserRow, 'id'>): Promise<UserRow> {
    const userId = await this.repos.users.insert(user)
    return await this.getUser({ id: userId }) as UserRow
  }

  async updateUser(user: any): Promise<void> {
    await this.repos.users.update(user)
  }

  async getOrCreateUserByRequest(req: any): Promise<UserRow> {
    // if user is already set on the request use that one
    if (req.user) {
      return req.user
    }
    let data = await this.getUserInfoByRequest(req)
    if (!data.user) {
      await this.repos.users.insert({
        client_id: req.headers[HEADER_CLIENT_ID],
        created: new Date(),
        name: '',
        email: '',
      })
      data = await this.getUserInfoByRequest(req)
    }
    // here the user is already guaranteed to exist (as UserRow is fine here)
    return data.user as UserRow
  }

  async getUser(where: WhereRaw): Promise<UserRow | null> {
    return await this.repos.users.get(where)
  }

  async getToken(where: WhereRaw): Promise<TokenRow | null> {
    return await this.repos.tokens.get(where)
  }

  async addAuthToken(userId: UserId): Promise<string> {
    const token = generateToken()
    await this.repos.tokens.insert({ user_id: userId, token, type: 'auth' })
    return token
  }

  async getUserInfoByRequest(req: any): Promise<UserInfo> {
    const token = req.cookies[COOKIE_TOKEN] || null
    const tokenRow: TokenRow | null = token
      ? await this.getToken({ token, type: 'auth' })
      : null
    let user: UserRow | null = tokenRow ? await this.getUser({ id: tokenRow.user_id }) : null

    if (user && tokenRow) {
      return {
        token: tokenRow.token,
        user: user,
        user_type: 'user',
      }
    }

    // when no token is given or the token is not found or the user is not found
    // we fall back to check the request for client id.
    user = await this.getUser({ client_id: req.headers[HEADER_CLIENT_ID] })
    return {
      token: null,
      user: user,
      user_type: user ? 'guest' : null,
    }
  }

  getUserByIdentity(identity: IdentityRow): Promise<UserRow | null> {
    return this.getUser({ id: identity.user_id })
  }
}
