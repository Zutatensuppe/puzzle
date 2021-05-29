import fs from 'fs'
import bsqlite from 'better-sqlite3'
import Integer from 'integer'
import { logger } from '../common/Util'

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
export type OrderBy = Array<Record<string, 1|-1>>

interface Where {
  sql: string
  values: Array<any>
}

class Db {
  file: string
  patchesDir: string
  dbh: bsqlite.Database

  constructor(file: string, patchesDir: string) {
    this.file = file
    this.patchesDir = patchesDir
    this.dbh = bsqlite(this.file)
  }

  close(): void {
    this.dbh.close()
  }

  patch (verbose: boolean =true): void {
    if (!this.get('sqlite_master', {type: 'table', name: 'db_patches'})) {
      this.run('CREATE TABLE db_patches ( id TEXT PRIMARY KEY);', [])
    }

    const files = fs.readdirSync(this.patchesDir)
    const patches = (this.getMany('db_patches')).map(row => row.id)

    for (const f of files) {
      if (patches.includes(f)) {
        if (verbose) {
          log.info(`➡ skipping already applied db patch: ${f}`)
        }
        continue
      }
      const contents = fs.readFileSync(`${this.patchesDir}/${f}`, 'utf-8')

      const all = contents.split(';').map(s => s.trim()).filter(s => !!s)
      try {
        this.dbh.transaction((all) => {
          for (const q of all) {
            if (verbose) {
              log.info(`Running: ${q}`)
            }
            this.run(q)
          }
          this.insert('db_patches', {id: f})
        })(all)

        log.info(`✓ applied db patch: ${f}`)
      } catch (e) {
        log.error(`✖ unable to apply patch: ${f} ${e}`)
        return
      }
    }
  }

  _buildWhere (where: WhereRaw): Where {
    const wheres = []
    const values = []
    for (const k of Object.keys(where)) {
      if (where[k] === null) {
        wheres.push(k + ' IS NULL')
        continue
      }

      if (typeof where[k] === 'object') {
        let prop = '$nin'
        if (where[k][prop]) {
          if (where[k][prop].length > 0) {
            wheres.push(k + ' NOT IN (' + where[k][prop].map(() => '?') + ')')
            values.push(...where[k][prop])
          }
          continue
        }
        prop = '$in'
        if (where[k][prop]) {
          if (where[k][prop].length > 0) {
            wheres.push(k + ' IN (' + where[k][prop].map(() => '?') + ')')
            values.push(...where[k][prop])
          }
          continue
        }

        // TODO: implement rest of mongo like query args ($eq, $lte, $in...)
        throw new Error('not implemented: ' + JSON.stringify(where[k]))
      }

      wheres.push(k + ' = ?')
      values.push(where[k])
    }

    return {
      sql: wheres.length > 0 ? ' WHERE ' + wheres.join(' AND ') : '',
      values,
    }
  }

  _buildOrderBy (orderBy: OrderBy): string {
    const sorts = []
    for (const s of orderBy) {
      const k = Object.keys(s)[0]
      sorts.push(k + ' COLLATE NOCASE ' + (s[k] > 0 ? 'ASC' : 'DESC'))
    }
    return sorts.length > 0 ? ' ORDER BY ' + sorts.join(', ') : ''
  }

  _get (query: string, params: Params = []): any {
    return this.dbh.prepare(query).get(...params)
  }

  run (query: string, params: Params = []): bsqlite.RunResult {
    return this.dbh.prepare(query).run(...params)
  }

  _getMany (query: string, params: Params = []): Array<any> {
    return this.dbh.prepare(query).all(...params)
  }

  get (
    table: string,
    whereRaw: WhereRaw = {},
    orderBy: OrderBy = []
  ): any {
    const where = this._buildWhere(whereRaw)
    const orderBySql = this._buildOrderBy(orderBy)
    const sql = 'SELECT * FROM ' + table + where.sql + orderBySql
    return this._get(sql, where.values)
  }

  getMany (
    table: string,
    whereRaw: WhereRaw = {},
    orderBy: OrderBy = []
  ): Array<any> {
    const where = this._buildWhere(whereRaw)
    const orderBySql = this._buildOrderBy(orderBy)
    const sql = 'SELECT * FROM ' + table + where.sql + orderBySql
    return this._getMany(sql, where.values)
  }

  delete (table: string, whereRaw: WhereRaw = {}): bsqlite.RunResult {
    const where = this._buildWhere(whereRaw)
    const sql = 'DELETE FROM ' + table + where.sql
    return this.run(sql, where.values)
  }

  exists (table: string, whereRaw: WhereRaw): boolean {
    return !!this.get(table, whereRaw)
  }

  upsert (
    table: string,
    data: Data,
    check: WhereRaw,
    idcol: string|null = null
  ): any {
    if (!this.exists(table, check)) {
      return this.insert(table, data)
    }
    this.update(table, data, check)
    if (idcol === null) {
      return 0 // dont care about id
    }

    return this.get(table, check)[idcol] // get id manually
  }

  insert (table: string, data: Data): Integer.IntLike {
    const keys = Object.keys(data)
    const values = keys.map(k => data[k])
    const sql = 'INSERT INTO '+ table
      + ' (' + keys.join(',') + ')'
      + ' VALUES (' + keys.map(() => '?').join(',') + ')'
    return this.run(sql, values).lastInsertRowid
  }

  update (table: string, data: Data, whereRaw: WhereRaw = {}): void {
    const keys = Object.keys(data)
    if (keys.length === 0) {
      return
    }
    const values = keys.map(k => data[k])
    const setSql = ' SET ' + keys.join(' = ?,') + ' = ?'
    const where = this._buildWhere(whereRaw)

    const sql = 'UPDATE ' + table + setSql + where.sql
    this.run(sql, [...values, ...where.values])
  }
}

export default Db
