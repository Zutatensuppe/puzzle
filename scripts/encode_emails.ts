import { logger } from '../common/src/Util'
import config from '../server/src/Config'
import Db from '../server/src/Db'
import Crypto from '../server/src/Crypto'

const log = logger()

const db = new Db(config.db.connectStr, config.dir.DB_PATCHES_DIR)

;(async () => {
  await db.connect()
  await db.patch(true)
  const identityRows = await db.getMany('user_identity')
  const userRows = await db.getMany('users')
  const accountRows = await db.getMany('accounts')

  for (const tmp of identityRows) {
    if (tmp.provider_email) {
      await db.update('user_identity', { provider_email: Crypto.encrypt(tmp.provider_email) }, { id: tmp.id })
    }
  }

  for (const tmp of userRows) {
    if (tmp.email) {
      await db.update('users', { email: Crypto.encrypt(tmp.email) }, { id: tmp.id })
    }
  }

  for (const tmp of accountRows) {
    if (tmp.email) {
      await db.update('accounts', { email: Crypto.encrypt(tmp.email) }, { id: tmp.id })
    }
  }

  await db.close()
})()
