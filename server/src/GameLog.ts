import { LOG_TYPE } from '../../common/src/Protocol'
import Time from '../../common/src/Time'
import { Game, GameId, LogEntry, Timestamp } from '../../common/src/Types'
import { logger } from './../../common/src/Util'
import config from './Config'
import fs from './FileSystem'

const log = logger('GameLog.js')

const LINES_PER_LOG_FILE = 10000
const POST_GAME_LOG_DURATION = 5 * Time.MIN

const LOG_EXISTS: Record<GameId, boolean> = {}

const shouldLog = (gameId: GameId, finishTs: Timestamp, currentTs: Timestamp): boolean => {
  if (LOG_EXISTS[gameId] === false) {
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

export const filename = (gameId: GameId, offset: number) => `${config.dir.DATA_DIR}/log/${gameId}/log_${gameId}-${offset}.log`
export const filenameGz = (gameId: GameId, offset: number) => `${filename(gameId, offset)}.gz`
export const idxname = (gameId: GameId) => `${config.dir.DATA_DIR}/log/${gameId}/log_${gameId}.idx.log`

export const gzFilenameOrFilename = async (gameId: GameId, offset: number) => {
  const gz = filenameGz(gameId, offset)
  if (await fs.exists(gz)) {
    return gz
  }

  const raw = filename(gameId, offset)
  if (await fs.exists(raw)) {
    return raw
  }
  return ''
}

const create = async (gameId: GameId, ts: Timestamp): Promise<void> => {
  await prepareLogDir(gameId)
  const idxfile = idxname(gameId)
  if (await fs.exists(idxfile)) {
    // idx file already exists. but this should not happen :(
    LOG_EXISTS[gameId] = false
    return
  }

  try {
    await fs.writeFile(idxfile, JSON.stringify({
      gameId: gameId,
      total: 0,
      lastTs: ts,
      currentFile: '',
      perFile: LINES_PER_LOG_FILE,
    }))
    LOG_EXISTS[gameId] = true
  } catch (e) {
    console.error('failed to write idxfile', idxfile, e)
    LOG_EXISTS[gameId] = false
  }
}

const exists = async (gameId: GameId): Promise<boolean> => {
  if (LOG_EXISTS[gameId] === false) {
    return false
  }
  const idxfile = idxname(gameId)
  return await fs.exists(idxfile)
}

async function hasReplay(game: Game): Promise<boolean> {
  if (!await exists(game.id)) {
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

const _log = async (gameId: GameId, logRow: LogEntry): Promise<void> => {
  if (LOG_EXISTS[gameId] === false) {
    return
  }
  const idxfile = idxname(gameId)

  if (!await fs.exists(idxfile)) {
    LOG_EXISTS[gameId] = false
    return
  }

  let idxObj: any
  try {
    const idxData = await fs.readFile(idxfile)
    idxObj = JSON.parse(idxData)
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
  try {
    await fs.appendFile(idxObj.currentFile, line + '\n')
  } catch (e) {
    console.error('failed to append to log file', idxObj.currentFile, e)
    LOG_EXISTS[gameId] = false
    return
  }

  idxObj.total++
  idxObj.lastTs = ts
  try {
    await fs.writeFile(idxfile, JSON.stringify(idxObj))
  } catch (e) {
    console.error('failed to write idxfile', idxfile, e)
    LOG_EXISTS[gameId] = false
    return
  }
}

const prepareLogDir = async (gameId: GameId): Promise<void> => {
  const dir = `${config.dir.DATA_DIR}/log/${gameId}`
  if (!await fs.exists(dir)) {
    await fs.mkdir(dir)
  }
}

export default {
  shouldLog,
  create,
  exists,
  hasReplay,
  log: _log,
  gzFilenameOrFilename,
}
