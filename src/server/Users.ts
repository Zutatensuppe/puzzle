import { TokenRow } from '../common/Types'
import { COOKIE_TOKEN, generateToken } from './Auth'
import Db, { WhereRaw } from './Db'

const TABLE_USERS = 'users'
const TABLE_USER_IDENTITY = 'user_identity'
const TABLE_ACCOUNTS = 'accounts'
const TABLE_TOKENS = 'tokens'

const HEADER_CLIENT_ID = 'client-id'

export interface UserRow {
  id: number
  created: Date
  client_id: string
  name: string
  email: string
}

interface UserInfo {
  token: string | null,
  user: UserRow | null,
  user_type: 'guest' | 'user' | null,
}

interface IdentityRow {
  id: number
  user_id: number
  provider_name: string
  provider_id: string
  provider_email: string
}

interface AccountRow {
  id: number
  created: Date
  email: string
  password: string
  salt: string
  status: 'verified' | 'verification_pending'
}

interface UserGroupRow {
  id: number
  name: string
}

const createAccount = async (db: Db, account: any): Promise<AccountRow> => {
  const accountId = await db.insert(TABLE_ACCOUNTS, account, 'id') as number
  return await db.get(TABLE_ACCOUNTS, { id: accountId }) as AccountRow
}

const createIdentity = async (db: Db, identity: any): Promise<IdentityRow> => {
  const identityId = await db.insert(TABLE_USER_IDENTITY, identity, 'id') as number
  return await db.get(TABLE_USER_IDENTITY, { id: identityId }) as IdentityRow
}

const updateIdentity = async (db: Db, identity: any): Promise<void> => {
  await db.update(TABLE_USER_IDENTITY, identity, { id: identity.id })
}

const getIdentity = async (db: Db, where: WhereRaw): Promise<IdentityRow | null> => {
  return await db.get(TABLE_USER_IDENTITY, where)
}

const getAccount = async (db: Db, where: WhereRaw): Promise<AccountRow | null> => {
  return await db.get(TABLE_ACCOUNTS, where)
}

const createUser = async (db: Db, user: any): Promise<UserRow> => {
  const userId = await db.insert(TABLE_USERS, user, 'id') as number
  return await getUser(db, { id: userId }) as UserRow
}

const updateUser = async (db: Db, user: any): Promise<void> => {
  await db.update(TABLE_USERS, user, { id: user.id })
}

const getOrCreateUserByRequest = async (db: Db, req: any): Promise<UserRow> => {
  // if user is already set on the request use that one
  if (req.user) {
    return req.user
  }
  let data = await getUserInfoByRequest(db, req)
  if (!data.user) {
    await db.insert(TABLE_USERS, {
      client_id: req.headers[HEADER_CLIENT_ID],
      created: new Date(),
    })
    data = await getUserInfoByRequest(db, req)
  }
  // here the user is already guaranteed to exist (as UserRow is fine here)
  return data.user as UserRow
}

const getUser = async (db: Db, where: WhereRaw): Promise<UserRow | null> => {
  const user = await db.get(TABLE_USERS, where)
  if (user) {
    user.id = parseInt(user.id, 10)
  }
  return user
}

const getToken = async (db: Db, where: WhereRaw): Promise<TokenRow | null> => {
  return await db.get(TABLE_TOKENS, where)
}

const addAuthToken = async (db: Db, userId: number): Promise<string> => {
  const token = generateToken()
  await db.insert(TABLE_TOKENS, { user_id: userId, token, type: 'auth' })
  return token
}

const getUserInfoByRequest = async (db: Db, req: any): Promise<UserInfo> => {
  const token = req.cookies[COOKIE_TOKEN] || null
  const tokenRow: TokenRow | null = token
    ? await getToken(db, { token, type: 'auth' })
    : null
  let user: UserRow | null = tokenRow ? await getUser(db, { id: tokenRow.user_id }) : null

  if (user && tokenRow) {
    return {
      token: tokenRow.token,
      user: user,
      user_type: 'user',
    }
  }

  // when no token is given or the token is not found or the user is not found
  // we fall back to check the request for client id.
  user = await getUser(db, { client_id: req.headers[HEADER_CLIENT_ID] })
  return {
    token: null,
    user: user,
    user_type: user ? 'guest' : null,
  }
}

const getUserByIdentity = async (db: Db, identity: IdentityRow): Promise<UserRow | null> => {
  return getUser(db, { id: identity.user_id })
}

const getGroups = async (db: Db, userId: number): Promise<UserGroupRow[]> => {
  const relations = await db.getMany('user_x_user_group', { user_id: userId })
  const groupIds = relations.map(r => r.user_group_id)
  return await db.getMany('user_groups', { id: { '$in': groupIds }}) as UserGroupRow[]
}

export default {
  getOrCreateUserByRequest,
  getUserInfoByRequest,
  getUserByIdentity,
  createUser,
  updateUser,
  getUser,
  createIdentity,
  updateIdentity,
  getIdentity,
  createAccount,
  getAccount,
  addAuthToken,
  getGroups,
}
