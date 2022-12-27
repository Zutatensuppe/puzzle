import { logger, uniqId } from '../src/common/Util'
import Db from '../src/server/Db'
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

  const username: string = `${await question('Username: ')}`
  const password: string = `${await question('Password: ')}`

  const salt = generateSalt()
  const user = {
    login: username,
    pass: passwordHash(password, salt),
    salt: salt,
    client_id: uniqId(),
    created: new Date(),
  }

  const user_id = await db.insert('users', user)
  log.info('user created/updated: ' + user_id)

  await db.close()
}

run()
