import fs from 'fs'
import { logger } from './../common/Util'
import { DATA_DIR } from './../server/Dirs'

const log = logger('GameLog.js')

const filename = (gameId: string) => `${DATA_DIR}/log_${gameId}.log`

const create = (gameId: string) => {
  const file = filename(gameId)
  if (!fs.existsSync(file)) {
    fs.appendFileSync(file, '')
  }
}

const exists = (gameId: string) => {
  const file = filename(gameId)
  return fs.existsSync(file)
}

const _log = (gameId: string, ...args: Array<any>) => {
  const file = filename(gameId)
  if (!fs.existsSync(file)) {
    return
  }
  const str = JSON.stringify(args)
  fs.appendFileSync(file, str + "\n")
}

const get = (gameId: string) => {
  const file = filename(gameId)
  if (!fs.existsSync(file)) {
    return []
  }
  const lines = fs.readFileSync(file, 'utf-8').split("\n")
  return lines.filter((line: string) => !!line).map((line: string) => {
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
