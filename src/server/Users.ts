import Db from './Db'

const TABLE = 'users'

const HEADER_CLIENT_ID = 'client-id'
const HEADER_CLIENT_SECRET = 'client-secret'

interface UserRow {
  id: number
  created: Date
  client_id: string
  client_secret: string
}

const getOrCreateUser = async (db: Db, req: any): Promise<UserRow> => {
  let user = await getUser(db, req)
  if (!user) {
    await db.insert(TABLE, {
      'client_id': req.headers[HEADER_CLIENT_ID],
      'client_secret': req.headers[HEADER_CLIENT_SECRET],
      'created': new Date(),
    })
    user = await getUser(db, req) as UserRow
  }
  return user
}

const getUser = async (db: Db, req: any): Promise<UserRow | null> => {
  const user = await db.get(TABLE, {
    'client_id': req.headers[HEADER_CLIENT_ID],
    'client_secret': req.headers[HEADER_CLIENT_SECRET],
  })
  if (user) {
    user.id = parseInt(user.id, 10)
  }
  return user
}

export default {
  getOrCreateUser,
  getUser,
}
