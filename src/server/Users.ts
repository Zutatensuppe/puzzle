import Time from '../common/Time'
import Db from './Db'

const TABLE = 'users'

const HEADER_CLIENT_ID = 'client-id'
const HEADER_CLIENT_SECRET = 'client-secret'

const getOrCreateUser = (db: Db, req: any): any => {
  let user = getUser(db, req)
  if (!user) {
    db.insert(TABLE, {
      'client_id': req.headers[HEADER_CLIENT_ID],
      'client_secret': req.headers[HEADER_CLIENT_SECRET],
      'created': Time.timestamp(),
    })
    user = getUser(db, req)
  }
  return user
}

const getUser = (db: Db, req: any): any => {
  const user = db.get(TABLE, {
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
