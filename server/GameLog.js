import fs from 'fs'
import { logger } from '../common/Util.js'

const log = logger('GameLog.js')

const DATA_DIR = './../data'

const filename = (gameId) => `${DATA_DIR}/log_${gameId}.log`

const create = (gameId) => {
  const file = filename(gameId)
  if (!fs.existsSync(file)) {
    fs.appendFileSync(file, '')
  }
}

const exists = (gameId) => {
  const file = filename(gameId)
  return fs.existsSync(file)
}

const _log = (gameId, ...args) => {
  const file = filename(gameId)
  if (!fs.existsSync(file)) {
    return
  }
  const str = JSON.stringify(args)
  fs.appendFileSync(file, str + "\n")
}

const get = (gameId) => {
  const file = filename(gameId)
  if (!fs.existsSync(file)) {
    return []
  }
  const lines = fs.readFileSync(file, 'utf-8').split("\n")
  return lines.filter(line => !!line).map((line) => {
    try {
      return JSON.parse(line)
    } catch (e) {
      log.log(line)
      log.log(e)
    }
  })
}

export default {
  create,
  exists,
  log: _log,
  get,
}
