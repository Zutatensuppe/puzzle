import fs from 'fs'
import readline from 'readline'
import stream from 'stream'
import Time from '../common/Time'
import { Timestamp } from '../common/Types'
import { logger } from './../common/Util'
import { DATA_DIR } from './../server/Dirs'

const log = logger('GameLog.js')

const LINES_PER_LOG_FILE = 10000
const POST_GAME_LOG_DURATION = 5 * Time.MIN

const shouldLog = (finishTs: Timestamp, currentTs: Timestamp): boolean => {
  // when not finished yet, always log
  if (!finishTs) {
    return true
  }

  // in finished games, log max POST_GAME_LOG_DURATION after
  // the game finished, to record winning dance moves etc :P
  const timeSinceGameEnd = currentTs - finishTs
  return timeSinceGameEnd <= POST_GAME_LOG_DURATION
}

export const filename = (gameId: string, offset: number) => `${DATA_DIR}/log_${gameId}-${offset}.log`
export const idxname = (gameId: string) => `${DATA_DIR}/log_${gameId}.idx.log`

const create = (gameId: string): void => {
  const idxfile = idxname(gameId)
  if (!fs.existsSync(idxfile)) {
    const logfile = filename(gameId, 0)
    fs.appendFileSync(logfile, "")
    fs.appendFileSync(idxfile, JSON.stringify({
      gameId: gameId,
      total: 0,
      lastTs: 0,
      currentFile: logfile,
      perFile: LINES_PER_LOG_FILE,
    }))
  }
}

const exists = (gameId: string): boolean => {
  const idxfile = idxname(gameId)
  return fs.existsSync(idxfile)
}

const _log = (gameId: string, type: number, ...args: Array<any>): void => {
  const idxfile = idxname(gameId)
  if (!fs.existsSync(idxfile)) {
    return
  }

  const ts: Timestamp = args[args.length - 1]
  const otherArgs: any[] = args.slice(0, -1)

  const idx = JSON.parse(fs.readFileSync(idxfile, 'utf-8'))
  idx.total++
  const diff = ts - idx.lastTs
  idx.lastTs = ts
  const line = JSON.stringify([type, ...otherArgs, diff]).slice(1, -1)
  fs.appendFileSync(idx.currentFile, line + "\n")

  // prepare next log file
  if (idx.total % idx.perFile === 0) {
    const logfile = filename(gameId, idx.total)
    fs.appendFileSync(logfile, "")
    idx.currentFile = logfile
  }
  fs.writeFileSync(idxfile, JSON.stringify(idx))
}

const get = (
  gameId: string,
  offset: number = 0,
): any[] => {
  const idxfile = idxname(gameId)
  if (!fs.existsSync(idxfile)) {
    return []
  }

  const file = filename(gameId, offset)
  if (!fs.existsSync(file)) {
    return []
  }

  const log = fs.readFileSync(file, 'utf-8').split("\n")
  return log.filter(line => !!line).map(line => {
    return JSON.parse(`[${line}]`)
  })
}

export default {
  shouldLog,
  create,
  exists,
  log: _log,
  get,
}
