import Db from './Db'

const TABLE = 'users'

const HEADER_CLIENT_ID = 'client-id'
const HEADER_CLIENT_SECRET = 'client-secret'

const getOrCreateUser = async (db: Db, req: any): Promise<any> => {
  let user = await getUser(db, req)
  if (!user) {
    await db.insert(TABLE, {
      'client_id': req.headers[HEADER_CLIENT_ID],
      'client_secret': req.headers[HEADER_CLIENT_SECRET],
      'created': new Date(),
    })
    user = await getUser(db, req)
  }
  return user
}

const getUser = async (db: Db, req: any): Promise<any> => {
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
