import { logger, uniqId } from '../src/common/Util'
import Db from '../src/server/Db'
import Users from '../src/server/Users'
import config from '../src/server/Config'
import { generateSalt, passwordHash } from '../src/server/Auth'
import readline from 'readline'

const question = (q: any) => new Promise((resolve, reject) => {
  const cl = readline.createInterface(process.stdin, process.stdout)
  cl.question(q, answer => {
    cl.close()
    resolve(answer)
  })
})

const log = logger('create_user.ts')

const db = new Db(config.db.connectStr, config.dir.DB_PATCHES_DIR)

async function run() {
  await db.connect()
  await db.patch(true)

  // for each user in the db generate a random pass and set a salt

  log.info('Please enter credentials for the new user.')

  const email: string = `${await question('Email: ')}`
  const password: string = `${await question('Password: ')}`
  const displayName: string = `${await question('Display Name: ')}`

  const salt = generateSalt()

  const account = await Users.createAccount(db, {
    created: new Date(),
    email: email,
    password: passwordHash(password, salt),
    salt: salt,
    status: 'verified',
  })

  const user = await Users.createUser(db, {
    created: new Date(),
    name: displayName,
    client_id: uniqId(),
  })

  const identity = await Users.createIdentity(db, {
    user_id: user.id,
    provider_name: 'local',
    provider_id: account.id,
  })

  log.info('user created')
  log.info('identityId: ' + identity.id)
  log.info('userId:     ' + user.id)
  log.info('accountId:  ' + account.id)

  await db.close()
}

run()
