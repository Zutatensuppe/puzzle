import { LOG_TYPE } from '../../common/src/Protocol'
import Time from '../../common/src/Time'
import { Game, GameId, GameLogInfoByGameIds, LogEntry, LogIndex, Timestamp } from '../../common/src/Types'
import { logger } from './../../common/src/Util'
import config from './Config'
import fs from './FileSystem'

const log = logger('GameLog.js')

const LINES_PER_LOG_FILE = 10000
const POST_GAME_LOG_DURATION = 5 * Time.MIN

const GAME_LOG_PREVENT_READ_DISK: Record<GameId, boolean> = {}
const GAME_LOG_IDX: Record<GameId, LogIndex> = {}
const GAME_LOG: Record<GameId, Record<string, string[]>> = {}
const GAME_LOG_DIRTY: Record<GameId, boolean> = {}

const shouldLog = (gameId: GameId, finishTs: Timestamp, currentTs: Timestamp): boolean => {
  if (!GAME_LOG_IDX[gameId]) {
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

const unsetGame = (gameId: GameId): void => {
  delete GAME_LOG_IDX[gameId]
  delete GAME_LOG[gameId]
  delete GAME_LOG_DIRTY[gameId]
  delete GAME_LOG_PREVENT_READ_DISK[gameId]
}

const flushToDisk = async (gameId: GameId): Promise<void> => {
  if (!GAME_LOG[gameId]) {
    return
  }

  if (!GAME_LOG_DIRTY[gameId]) {
    return
  }

  await prepareLogDir(gameId)

  // write index file
  const idxfile = idxname(gameId)
  await fs.writeFile(idxfile, JSON.stringify(GAME_LOG_IDX[gameId]))

  // write each log file
  for (const file in GAME_LOG[gameId]) {
    await fs.writeFile(file, GAME_LOG[gameId][file].join('\n'))
    if (GAME_LOG[gameId][file].length === GAME_LOG_IDX[gameId].perFile) {
      delete GAME_LOG[gameId][file]
    }
  }

  GAME_LOG_DIRTY[gameId] = false
  delete GAME_LOG_PREVENT_READ_DISK[gameId]
}

const loadFromDisk = async (gameId: GameId): Promise<void> => {
  if (GAME_LOG_IDX[gameId]) {
    return
  }

  if (GAME_LOG_PREVENT_READ_DISK[gameId]) {
    return
  }

  const idxfile = idxname(gameId)
  let idxObj: any
  try {
    const idxData = await fs.readFile(idxfile)
    idxObj = JSON.parse(idxData)
  } catch {
    log.error('failed to read idxfile', idxfile)
    GAME_LOG_PREVENT_READ_DISK[gameId] = true
    return
  }
  let lines = []
  try {
    const currentFileContents = await fs.readFile(idxObj.currentFile)
    lines = currentFileContents.split('\n')
  } catch {
    log.error('failed to read currentFile', idxObj.currentFile)
    return
  }
  GAME_LOG_IDX[gameId] = idxObj
  GAME_LOG[gameId] = {
    [GAME_LOG_IDX[gameId].currentFile]: lines,
  }
  GAME_LOG_DIRTY[gameId] = false
}

const create = (gameId: GameId, ts: Timestamp): void => {
  if (GAME_LOG_IDX[gameId]) {
    return
  }

  GAME_LOG_IDX[gameId] = {
    gameId: gameId,
    total: 0,
    lastTs: ts,
    currentFile: filename(gameId, 0),
    perFile: LINES_PER_LOG_FILE,
  }
  GAME_LOG[gameId] = {
    [GAME_LOG_IDX[gameId].currentFile]: [],
  }
  GAME_LOG_DIRTY[gameId] = true
}

const exists = async (gameId: GameId): Promise<boolean> => {
  return !!(await getIndex(gameId))
}

const getIndex = async (gameId: GameId): Promise<LogIndex | null> => {
  await loadFromDisk(gameId)
  return GAME_LOG_IDX[gameId]
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

const _log = (gameId: GameId, logRow: LogEntry): void => {
  if (!GAME_LOG_IDX[gameId]) {
    return
  }

  const idxObj = GAME_LOG_IDX[gameId]
  if (idxObj.total % idxObj.perFile === 0) {
    idxObj.currentFile = filename(gameId, idxObj.total)
  }

  const type = logRow[0]
  const timestampIdx = type === LOG_TYPE.HEADER ? 4 : (logRow.length - 1)
  const ts: Timestamp = logRow[timestampIdx] as Timestamp
  if (type !== LOG_TYPE.HEADER) {
    // for everything but header save the diff to last log entry
    logRow[timestampIdx] = ts - idxObj.lastTs
  }

  const line = JSON.stringify(logRow).slice(1, -1)
  GAME_LOG[gameId][idxObj.currentFile] = GAME_LOG[gameId][idxObj.currentFile] || []
  GAME_LOG[gameId][idxObj.currentFile].push(line)
  idxObj.total++
  idxObj.lastTs = ts
  GAME_LOG_IDX[gameId] = idxObj
  GAME_LOG_DIRTY[gameId] = true
}

const prepareLogDir = async (gameId: GameId): Promise<void> => {
  const dir = `${config.dir.DATA_DIR}/log/${gameId}`
  if (!await fs.exists(dir)) {
    await fs.mkdir(dir)
  }
}

const getGameLogInfos = (): GameLogInfoByGameIds => {
  const infos: GameLogInfoByGameIds = {}
  for (const gameIdStr in GAME_LOG_IDX) {
    const gameId = gameIdStr as GameId
    let logEntriesToFlush = 0
    if (GAME_LOG_DIRTY[gameId]) {
      for (const file in GAME_LOG[gameId]) {
        logEntriesToFlush += GAME_LOG[gameId][file].length
      }
    }
    infos[gameId] = {
      logIndex: GAME_LOG_IDX[gameId],
      logEntriesToFlush,
    }
  }
  return infos
}

export default {
  shouldLog,
  create,
  exists,
  getIndex,
  loadFromDisk,
  flushToDisk,
  hasReplay,
  log: _log,
  gzFilenameOrFilename,
  getGameLogInfos,
  unsetGame,
}
