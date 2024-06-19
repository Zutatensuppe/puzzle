import fs from './FileSystem'
import * as pg from 'pg'
// @ts-ignore
const { Client } = pg.default
import { logger } from '../../common/src/Util'

const log = logger('Db.ts')

/**
 * TODO: create a more specific type for OrderBy.
 * It looks like this (example):
 * [
 *   {id: -1},  // by id descending
 *   {name: 1}, // then by name ascending
 * ]
 */
type Data = Record<string, any>
type Params = Array<any>

export type WhereRaw = Record<string, any>
export type OrderBy = Array<Record<string, 1 | -1>>
export interface Limit {
  offset: number
  limit: number
}

interface Where {
  sql: string
  values: Array<any>
  $i: number
}

class Db {
  patchesDir: string
  dbh: pg.Client

  constructor(connectStr: string, patchesDir: string) {
    this.patchesDir = patchesDir
    this.dbh = new Client(connectStr)
  }

  async connect(): Promise<void> {
    await this.dbh.connect()
  }

  async close(): Promise<void> {
    await this.dbh.end()
  }

  async patch(verbose: boolean = true): Promise<void> {
    await this.run('CREATE TABLE IF NOT EXISTS public.db_patches ( id TEXT PRIMARY KEY);', [])

    const files = await fs.readdir(this.patchesDir)
    const patches = (await this.getMany('public.db_patches')).map(row => row.id)

    for (const f of files) {
      if (patches.includes(f)) {
        if (verbose) {
          log.info(`➡ skipping already applied db patch: ${f}`)
        }
        continue
      }
      const contents = await fs.readFile(`${this.patchesDir}/${f}`)

      const all = contents.split(';').map(s => s.trim()).filter(s => !!s)
      try {
        try {
          await this.run('BEGIN')
          for (const q of all) {
            await this.run(q)
          }
          await this.run('COMMIT')
        } catch (e) {
          await this.run('ROLLBACK')
          throw e
        }
        await this.insert('public.db_patches', { id: f })
        log.info(`✓ applied db patch: ${f}`)
      } catch (e) {
        log.error(`✖ unable to apply patch: ${f} ${e}`)
        return
      }
    }
  }

  _buildWhere(where: WhereRaw, $i: number = 1): Where {
    const wheres = []
    const values = []
    for (const k of Object.keys(where)) {
      if (where[k] === null) {
        wheres.push(k + ' IS NULL')
        continue
      }

      if (typeof where[k] === 'object') {
        for (const prop of Object.keys(where[k])) {
          if (prop === '$nin') {
            if (where[k][prop].length > 0) {
              wheres.push(k + ' NOT IN (' + where[k][prop].map(() => `$${$i++}`) + ')')
              values.push(...where[k][prop])
            } else {
              wheres.push('TRUE')
            }
            continue
          }

          if (prop === '$in') {
            if (where[k][prop].length > 0) {
              wheres.push(k + ' IN (' + where[k][prop].map(() => `$${$i++}`) + ')')
              values.push(...where[k][prop])
            } else {
              wheres.push('FALSE')
            }
            continue
          }

          if (prop === '$gte') {
            wheres.push(k + ` >= $${$i++}`)
            values.push(where[k][prop])
            continue
          }

          if (prop === '$lte') {
            wheres.push(k + ` <= $${$i++}`)
            values.push(where[k][prop])
            continue
          }

          if (prop === '$gt') {
            wheres.push(k + ` > $${$i++}`)
            values.push(where[k][prop])
            continue
          }

          if (prop === '$lt') {
            wheres.push(k + ` < $${$i++}`)
            values.push(where[k][prop])
            continue
          }

          if (prop === '$ne') {
            if (where[k][prop] === null) {
              wheres.push(k + ` IS NOT NULL`)
            } else {
              wheres.push(k + ` != $${$i++}`)
              values.push(where[k][prop])
            }
            continue
          }

          if (prop === '$ilike') {
            wheres.push(k + ` ilike $${$i++}`)
            values.push(where[k][prop])
            continue
          }

          // TODO: implement rest of mongo like query args ($eq, $lte, $in...)
          throw new Error('not implemented: ' + prop + ' '+ JSON.stringify(where[k]))
        }
        continue
      }

      wheres.push(k + ` = $${$i++}`)
      values.push(where[k])
    }

    return {
      sql: wheres.length > 0 ? ' WHERE ' + wheres.join(' AND ') : '',
      values,
      $i,
    }
  }

  _buildOrderBy(orderBy: OrderBy): string {
    const sorts = []
    for (const s of orderBy) {
      const k = Object.keys(s)[0]
      sorts.push(k + ' ' + (s[k] > 0 ? 'ASC' : 'DESC'))
    }
    return sorts.length > 0 ? ' ORDER BY ' + sorts.join(', ') : ''
  }

  _buildLimit(limit: Limit): string {
    const parts = []

    // make sure we have integers, so we can safely inline the
    // values into the sql
    const limitVal = parseInt(`${limit.limit}`, 10)
    const offsetVal = parseInt(`${limit.offset}`, 10)

    if (limitVal >= 0) {
      parts.push(` LIMIT ${limitVal}`)
    }
    if (offsetVal >= 0) {
      parts.push(` OFFSET ${offsetVal}`)
    }
    return parts.join('')
  }

  async _get(query: string, params: Params = []): Promise<any> {
    try {
      return (await this.dbh.query(query, params)).rows[0] || null
    } catch (e) {
      log.info('_get', query, params)
      console.error(e)
      throw e
    }
  }

  async txn(fn: () => Promise<any>): Promise<any> {
    await this.dbh.query('BEGIN')
    try {
      const retval = await fn()
      await this.dbh.query('COMMIT')
      return retval
    } catch (e) {
      await this.dbh.query('ROLLBACK')
      log.error(e)
      return null
    }
  }

  async run(query: string, params: Params = []): Promise<pg.QueryResult> {
    try {
      return await this.dbh.query(query, params)
    } catch (e) {
      log.info('run', query, params)
      console.error(e)
      throw e
    }
  }

  async _getMany(query: string, params: Params = []): Promise<any[]> {
    try {
      return (await this.dbh.query(query, params)).rows || []
    } catch (e) {
      log.info('_getMany', query, params)
      console.error(e)
      throw e
    }
  }

  async get(
    table: string,
    whereRaw: WhereRaw = {},
    orderBy: OrderBy = [],
  ): Promise<any> {
    const rows = await this.getMany(table, whereRaw, orderBy, { offset: 0, limit: 1 })
    return rows.length > 0 ? rows[0] : null
  }

  async getMany(
    table: string,
    whereRaw: WhereRaw = {},
    orderBy: OrderBy = [],
    limit: Limit = { offset: -1, limit: -1 },
  ): Promise<any[]> {
    const where = this._buildWhere(whereRaw)
    const orderBySql = this._buildOrderBy(orderBy)
    const limitSql = this._buildLimit(limit)
    const sql = 'SELECT * FROM ' + table + where.sql + orderBySql + limitSql
    return await this._getMany(sql, where.values)
  }

  async count(
    table: string,
    whereRaw: WhereRaw = {},
  ): Promise<number> {
    const where = this._buildWhere(whereRaw)
    const sql = 'SELECT COUNT(*)::int FROM ' + table + where.sql
    const row = await this._get(sql, where.values)
    return row.count
  }

  async delete(table: string, whereRaw: WhereRaw = {}): Promise<pg.QueryResult> {
    const where = this._buildWhere(whereRaw)
    const sql = 'DELETE FROM ' + table + where.sql
    return await this.run(sql, where.values)
  }

  async upsert(
    table: string,
    data: Data,
    uniqueCols: string[], // must containunique columns!
    idcol: string | null = null,
  ): Promise<any> {
    const columns = Object.keys(data).join(', ')
    const values = Object.values(data)
    const conflictColumns = uniqueCols.join(', ')

    let sql = `
      INSERT INTO ${table} (${columns})
      VALUES (${values.map((_, index) => `$${index + 1}`).join(', ')})
      ON CONFLICT (${conflictColumns}) DO UPDATE SET
    `

    const keyOff = values.length

    Object.keys(data).forEach((key, index) => {
      sql += `${key} = $${keyOff + index + 1}, `
    })

    sql = sql.slice(0, -2) // Remove the last comma and space
    if (idcol) {
      sql += ` RETURNING ${idcol}`
      return (await this.run(sql, [...values, ...values])).rows[0][idcol]
    }
    await this.run(sql, [...values, ...values])
    return 0
  }

  async insert(table: string, data: Data, idcol: string | null = null): Promise<number | bigint> {
    const keys = Object.keys(data)
    const values = keys.map(k => data[k])

    let $i = 1
    let sql = 'INSERT INTO ' + table
      + ' (' + keys.join(',') + ')'
      + ' VALUES (' + keys.map(() => `$${$i++}`).join(',') + ')'
    if (idcol) {
      sql += ` RETURNING ${idcol}`
      return (await this.run(sql, values)).rows[0][idcol]
    }
    await this.run(sql, values)
    return 0
  }

  async insertMany(table: string, datas: Data[]): Promise<number | bigint> {
    if (datas.length === 0) {
      return 0
    }

    const keys = Object.keys(datas[0])
    const values: any[] = []

    let $i = 1
    const valueRows: string[] = []
    for (const data of datas) {
      valueRows.push('(' + keys.map(() => `$${$i++}`).join(',') + ')')
      values.push(...keys.map(k => data[k]))
    }

    const sql = 'INSERT INTO ' + table
      + ' (' + keys.join(',') + ')'
      + ' VALUES ' + valueRows.join(',')
    await this.run(sql, values)
    return 0
  }

  async update(table: string, data: Data, whereRaw: WhereRaw = {}): Promise<void> {
    const keys = Object.keys(data)
    if (keys.length === 0) {
      return
    }

    let $i = 1

    const values = keys.map(k => data[k])
    const setSql = ' SET ' + keys.map((k) => `${k} = $${$i++}`).join(',')
    const where = this._buildWhere(whereRaw, $i)

    const sql = 'UPDATE ' + table + setSql + where.sql
    await this.run(sql, [...values, ...where.values])
  }
}

export default Db
