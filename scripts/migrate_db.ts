import Db from './DbSqlite'
import DbPostgres from '../src/server/Db'
import { DB_FILE, DB_PATCHES_DIR } from '../src/server/Dirs'

const db = new Db(DB_FILE, DB_PATCHES_DIR)
const dbPostgres = new DbPostgres('postgres://hyottoko:hyottoko@localhost:5434/hyottoko', DB_PATCHES_DIR)

async function migrate_db() {

  await dbPostgres.connect()
  await dbPostgres.patch()

  let max = 0
  let table = 'categories'
  for (const v of db.getMany(table)) {
    await dbPostgres.insert(table, v)
    max = Math.max(v.id, max)
  }
  await dbPostgres.run(`SELECT setval('${table}_id_seq', ${max});`)

  max = 0
  table = 'users'
  for (const v of db.getMany(table)) {
    v.created = new Date(v.created)
    await dbPostgres.insert(table, v)
    max = Math.max(v.id, max)
  }
  await dbPostgres.run(`SELECT setval('${table}_id_seq', ${max});`)

  table = 'image_x_category'
  for (const v of db.getMany(table)) {
    await dbPostgres.insert(table, v)
  }

  max = 0
  table = 'images'
  for (const v of db.getMany(table)) {
    v.created = new Date(v.created)
    await dbPostgres.insert(table, v)
    max = Math.max(v.id, max)
  }
  await dbPostgres.run(`SELECT setval('${table}_id_seq', ${max});`)

  table = 'games'
  for (const v of db.getMany(table)) {
    v.created = new Date(v.created)
    v.finished = v.finished ? new Date(v.finished) : null
    await dbPostgres.insert(table, v)
  }

  await dbPostgres.close()
}

migrate_db()
