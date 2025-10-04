import type { GameInfo} from '../../common/src/Types'
import { ImageSearchSort, type AccountId, type ClientId, type CompleteUserProfile, type TokenRow, type UserGroupRow, type UserId, type UserRow } from '../../common/src/Types'
import { COOKIE_TOKEN, generateToken } from './Auth'
import type Db from './Db'
import type { WhereRaw } from './Db'
import type { GameService } from './GameService'
import type { Images } from './Images'
import type { AccountRow } from './repo/AccountsRepo'
import type { Repos } from './repo/Repos'
import type { IdentityRow } from './repo/UserIdentityRepo'
import type express from 'express'
import Time from '../../common/src/Time'
import { toJSONDateString } from '../../common/src/Util'

const HEADER_CLIENT_ID = 'client-id'

export type UserInfo = {
  token: string
  user: UserRow
  user_type: 'user'
} | {
  token: null,
  user: UserRow
  user_type: 'guest'
} | {
  token: null,
  user: null,
  user_type: null,
}

export class Users {
  constructor(
    private db: Db,
    private repos: Repos,
    private images: Images,
    private games: GameService,
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

  async createAccount(account: Omit<AccountRow, 'id'>): Promise<AccountRow> {
    const accountId = await this.repos.accounts.insert(account)
    return await this.repos.accounts.get({ id: accountId }) as AccountRow
  }

  async createIdentity(identity: Omit<IdentityRow, 'id'>): Promise<IdentityRow> {
    const identityId = await this.repos.userIdentity.insert(identity)
    return await this.repos.userIdentity.get({ id: identityId }) as IdentityRow
  }

  async updateIdentity(identity: IdentityRow): Promise<void> {
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

  async updateUser(user: UserRow): Promise<void> {
    await this.repos.users.update(user)
  }

  async getOrCreateUserByRequest(req: express.Request): Promise<UserRow> {
    // if user is already set on the request use that one
    if (req.userInfo?.user) {
      return req.userInfo.user
    }
    let data = await this.getUserInfoByRequest(req)
    if (!data.user) {
      const user = await this.createUser({
        client_id: String(req.headers[HEADER_CLIENT_ID]) as ClientId,
        // TODO: date gets converted to string automatically. fix this type hint
        // @ts-ignore
        created: new Date(),
        name: '',
        email: '',
      })
      data = { token: null, user, user_type: 'guest' }
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

  async getUserInfoByRequest(req: express.Request): Promise<UserInfo> {
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
    if (user) {
      return {
        token: null,
        user: user,
        user_type: 'guest',
      }
    }

    return {
      token: null,
      user: null,
      user_type: null,
    }
  }

  getUserByIdentity(identity: IdentityRow): Promise<UserRow | null> {
    return this.getUser({ id: identity.user_id })
  }

  public async getCompleteUserProfile(
    currentUserId: UserId,
    limitToUserId: UserId,
  ): Promise<CompleteUserProfile> {
    const user = await this.repos.users.get({ id: limitToUserId })
    if (!user) {
      throw new Error('not found')
    }

    const currentTimestamp = Time.timestamp()
    const totalGamesCount = await this.repos.games.countGamesByUser(currentUserId, limitToUserId)
    const totalPiecesCount = await this.repos.games.countGamePiecesByUser(currentUserId, limitToUserId)

    const finishedRows = await this.games.getPublicFinishedGames(0, 8, currentUserId, limitToUserId)
    const gamesFinished: GameInfo[] = []
    for (const row of finishedRows) {
      gamesFinished.push(await this.games.gameToGameInfo(row, currentTimestamp))
    }

    return {
      user: {
        id: user.id,
        joinDate: new Date(user.created),
        username: user.name,
      },
      stats: {
        totalGamesCount: totalGamesCount,
        totalPiecesCount: totalPiecesCount,
      },
      // not sure if we have a connection yet
      // (username maybe or livestream id == user id??)
      isLiveOnTwitch: false,
      games: gamesFinished,
      images: await this.images.imagesFromDb(
        '',
        ImageSearchSort.DATE_DESC,
        false,
        0,
        8,
        currentUserId,
        limitToUserId,
      ),
    }
  }
}
