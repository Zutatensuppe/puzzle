import Db from './Db'

const TABLE = 'users'

const HEADER_CLIENT_ID = 'client-id'

interface UserRow {
  id: number
  created: Date
  client_id: string
}

const getOrCreateUser = async (db: Db, req: any): Promise<UserRow> => {
  let user = await getUser(db, req)
  if (!user) {
    await db.insert(TABLE, {
      'client_id': req.headers[HEADER_CLIENT_ID],
      'created': new Date(),
    })
    user = await getUser(db, req) as UserRow
  }
  return user
}

const getUser = async (db: Db, req: any): Promise<UserRow | null> => {
  const user = await db.get(TABLE, {
    'client_id': req.headers[HEADER_CLIENT_ID],
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
