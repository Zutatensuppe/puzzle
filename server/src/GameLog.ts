import fs from 'fs'
import Protocol from '../../common/src/Protocol'
import Time from '../../common/src/Time'
import { DefaultScoreMode, DefaultShapeMode, DefaultSnapMode, Game, Timestamp } from '../../common/src/Types'
import { logger } from './../../common/src/Util'
import config from './Config'

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

export const filename = (gameId: string, offset: number) => `${config.dir.DATA_DIR}/log_${gameId}-${offset}.log`
export const idxname = (gameId: string) => `${config.dir.DATA_DIR}/log_${gameId}.idx.log`

const create = (gameId: string, ts: Timestamp): void => {
  const idxfile = idxname(gameId)
  if (!fs.existsSync(idxfile)) {
    fs.appendFileSync(idxfile, JSON.stringify({
      gameId: gameId,
      total: 0,
      lastTs: ts,
      currentFile: '',
      perFile: LINES_PER_LOG_FILE,
    }))
  }
}

const exists = (gameId: string): boolean => {
  const idxfile = idxname(gameId)
  return fs.existsSync(idxfile)
}

function hasReplay(game: Game): boolean {
  if (!exists(game.id)) {
    return false
  }
  if (game.gameVersion < 2) {
    // replays before gameVersion 2 are incompatible with current code
    return false
  }
  // from 2 onwards we try to stay compatible by keeping behavior same in
  // old functions and instead just add new functions for new versions
  return true
}

const _log = (gameId: string, type: number, ...args: Array<any>): void => {
  const idxfile = idxname(gameId)
  if (!fs.existsSync(idxfile)) {
    return
  }

  const idxObj = JSON.parse(fs.readFileSync(idxfile, 'utf-8'))
  if (idxObj.total % idxObj.perFile === 0) {
    idxObj.currentFile = filename(gameId, idxObj.total)
  }

  const timestampIdx = type === Protocol.LOG_HEADER ? 3 : (args.length - 1)
  const ts: Timestamp = args[timestampIdx]
  if (type !== Protocol.LOG_HEADER) {
    // for everything but header save the diff to last log entry
    args[timestampIdx] = ts - idxObj.lastTs
  }
  const line = JSON.stringify([type, ...args]).slice(1, -1)
  fs.appendFileSync(idxObj.currentFile, line + '\n')

  idxObj.total++
  idxObj.lastTs = ts
  fs.writeFileSync(idxfile, JSON.stringify(idxObj))
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

  const lines = fs.readFileSync(file, 'utf-8').split('\n')
  const log = lines.filter(line => !!line).map(line => {
    return JSON.parse(`[${line}]`)
  })
  if (offset === 0 && log.length > 0) {
    log[0][5] = DefaultScoreMode(log[0][5])
    log[0][6] = DefaultShapeMode(log[0][6])
    log[0][7] = DefaultSnapMode(log[0][7])
    log[0][8] = log[0][8] || null // creatorUserId
    log[0][9] = log[0][9] || 0 // private
    log[0][10] = log[0][10] || undefined // crop
  }
  return log
}

export default {
  shouldLog,
  create,
  exists,
  hasReplay,
  log: _log,
  get,
  filename,
  idxname,
}
