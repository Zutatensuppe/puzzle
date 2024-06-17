import fs from 'fs'
import { LOG_TYPE } from '../../common/src/Protocol'
import Time from '../../common/src/Time'
import { Game, LogEntry, Timestamp } from '../../common/src/Types'
import { logger } from './../../common/src/Util'
import config from './Config'

const log = logger('GameLog.js')

const LINES_PER_LOG_FILE = 10000
const POST_GAME_LOG_DURATION = 5 * Time.MIN

const LOG_EXISTS: Record<string, boolean> = {}

const shouldLog = (gameId: string, finishTs: Timestamp, currentTs: Timestamp): boolean => {
  if (!LOG_EXISTS[gameId]) {
      return false
  }

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
export const filenameGz = (gameId: string, offset: number) => `${filename(gameId, offset)}.gz`
export const idxname = (gameId: string) => `${config.dir.DATA_DIR}/log_${gameId}.idx.log`

export const gzFilenameOrFilename = (gameId: string, offset: number) => {
  const gz = filenameGz(gameId, offset)
  if (fs.existsSync(gz)) {
    return gz
  }
  const raw = filename(gameId, offset)
  if (fs.existsSync(raw)) {
    return raw
  }
  return ''
}

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
  LOG_EXISTS[gameId] = true
}

const exists = (gameId: string): boolean => {
  if (!LOG_EXISTS[gameId]) {
    return false
  }
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

const _log = (gameId: string, logRow: LogEntry): void => {
  if (!LOG_EXISTS[gameId]) {
    return
  }
  const idxfile = idxname(gameId)
  if (!fs.existsSync(idxfile)) {
    LOG_EXISTS[gameId] = false
    return
  }

  let idxObj: any
  try {
    idxObj = JSON.parse(fs.readFileSync(idxfile, 'utf-8'))
  } catch (e) {
    log.error('failed to read idxfile', idxfile)
    LOG_EXISTS[gameId] = false
    return
  }
  if (idxObj.total % idxObj.perFile === 0) {
    idxObj.currentFile = filename(gameId, idxObj.total)
  }

  const type = logRow[0]
  const timestampIdx = type === LOG_TYPE.HEADER? 4 : (logRow.length - 1)
  const ts: Timestamp = logRow[timestampIdx] as Timestamp
  if (type !== LOG_TYPE.HEADER) {
    // for everything but header save the diff to last log entry
    logRow[timestampIdx] = ts - idxObj.lastTs
  }

  const line = JSON.stringify(logRow).slice(1, -1)
  fs.appendFileSync(idxObj.currentFile, line + '\n')

  idxObj.total++
  idxObj.lastTs = ts
  fs.writeFileSync(idxfile, JSON.stringify(idxObj))
}

export default {
  shouldLog,
  create,
  exists,
  hasReplay,
  log: _log,
  filename,
  gzFilenameOrFilename,
  idxname,
}
