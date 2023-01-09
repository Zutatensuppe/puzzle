import Db, { WhereRaw } from './Db'

const TABLE_USERS = 'users'
const TABLE_USER_IDENTITY = 'user_identity'
const TABLE_ACCOUNTS = 'accounts'

const HEADER_CLIENT_ID = 'client-id'

interface UserRow {
  id: number
  created: Date
  client_id: string
  name: string
}

interface IdentityRow {
  id: number
  user_id: number
  provider_name: string
  provider_id: string
}

interface AccountRow {
  id: number
  created: Date
  email: string
  password: string
  salt: string
  status: 'verified' | 'verification_pending'
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
  let user = await getUserByRequest(db, req)
  if (!user) {
    await db.insert(TABLE_USERS, {
      client_id: req.headers[HEADER_CLIENT_ID],
      created: new Date(),
    })
    user = await getUserByRequest(db, req) as UserRow
  }
  return user
}

const getUser = async (db: Db, where: WhereRaw): Promise<UserRow | null> => {
  const user = await db.get(TABLE_USERS, where)
  if (user) {
    user.id = parseInt(user.id, 10)
  }
  return user
}

const getUserByRequest = async (db: Db, req: any): Promise<UserRow | null> => {
  return getUser(db, { client_id: req.headers[HEADER_CLIENT_ID] })
}

const getUserByIdentity = async (db: Db, identity: IdentityRow): Promise<UserRow | null> => {
  return getUser(db, { id: identity.user_id })
}

export default {
  getOrCreateUserByRequest,
  getUserByRequest,
  getUserByIdentity,
  createUser,
  updateUser,
  createIdentity,
  updateIdentity,
  getIdentity,
  getAccount,
  getUser,
}
