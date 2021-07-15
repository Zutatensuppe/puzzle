import fs from 'fs'
import GameCommon from './../common/GameCommon'
import { DefaultScoreMode, DefaultShapeMode, DefaultSnapMode, Game, Piece } from './../common/Types'
import Util, { logger } from './../common/Util'
import { Rng } from './../common/Rng'
import { DATA_DIR } from './Dirs'
import Time from './../common/Time'
import Db from './Db'

const log = logger('GameStorage.js')

const dirtyGames: Record<string, boolean> = {}
function setDirty(gameId: string): void {
  dirtyGames[gameId] = true
}
function setClean(gameId: string): void {
  delete dirtyGames[gameId]
}
function loadGamesFromDb(db: Db): void {
  const gameRows = db.getMany('games')
  for (const gameRow of gameRows) {
    loadGameFromDb(db, gameRow.id)
  }
}

function loadGameFromDb(db: Db, gameId: string): void {
  const gameRow = db.get('games', {id: gameId})

  let game
  try {
    game = JSON.parse(gameRow.data)
  } catch {
    log.log(`[ERR] unable to load game from db ${gameId}`);
  }
  if (typeof game.puzzle.data.started === 'undefined') {
    game.puzzle.data.started = gameRow.created
  }
  if (typeof game.puzzle.data.finished === 'undefined') {
    game.puzzle.data.finished = gameRow.finished
  }
  if (!Array.isArray(game.players)) {
    game.players = Object.values(game.players)
  }

  const gameObject: Game = storeDataToGame(game, game.creator_user_id)
  GameCommon.setGame(gameObject.id, gameObject)
}

function persistGamesToDb(db: Db): void {
  for (const gameId of Object.keys(dirtyGames)) {
    persistGameToDb(db, gameId)
  }
}

function persistGameToDb(db: Db, gameId: string): void {
  const game: Game|null = GameCommon.get(gameId)
  if (!game) {
    log.error(`[ERROR] unable to persist non existing game ${gameId}`)
    return
  }

  if (game.id in dirtyGames) {
    setClean(game.id)
  }

  db.upsert('games', {
    id: game.id,

    creator_user_id: game.creatorUserId,
    image_id: game.puzzle.info.image?.id,

    created: game.puzzle.data.started,
    finished: game.puzzle.data.finished,

    data: gameToStoreData(game)
  }, {
    id: game.id,
  })
  log.info(`[INFO] persisted game ${game.id}`)
}

/**
 * @deprecated
 */
function loadGamesFromDisk(): void {
  const files = fs.readdirSync(DATA_DIR)
  for (const f of files) {
    const m = f.match(/^([a-z0-9]+)\.json$/)
    if (!m) {
      continue
    }
    const gameId = m[1]
    loadGameFromDisk(gameId)
  }
}

/**
 * @deprecated
 */
function loadGameFromDisk(gameId: string): void {
  const file = `${DATA_DIR}/${gameId}.json`
  const contents = fs.readFileSync(file, 'utf-8')
  let game
  try {
    game = JSON.parse(contents)
  } catch {
    log.log(`[ERR] unable to load game from file ${file}`);
  }
  if (typeof game.puzzle.data.started === 'undefined') {
    game.puzzle.data.started = Math.round(fs.statSync(file).ctimeMs)
  }
  if (typeof game.puzzle.data.finished === 'undefined') {
    const unfinished = game.puzzle.tiles
      .map(Util.decodePiece)
      .find((t: Piece) => t.owner !== -1)
    game.puzzle.data.finished = unfinished ? 0 : Time.timestamp()
  }
  if (!Array.isArray(game.players)) {
    game.players = Object.values(game.players)
  }
  const gameObject: Game = storeDataToGame(game, null)
  GameCommon.setGame(gameObject.id, gameObject)
}

function storeDataToGame(storeData: any, creatorUserId: number|null): Game {
  return {
    id: storeData.id,
    creatorUserId,
    rng: {
      type: storeData.rng ? storeData.rng.type : '_fake_',
      obj: storeData.rng ? Rng.unserialize(storeData.rng.obj) : new Rng(0),
    },
    puzzle: storeData.puzzle,
    players: storeData.players,
    evtInfos: {},
    scoreMode: DefaultScoreMode(storeData.scoreMode),
    shapeMode: DefaultShapeMode(storeData.shapeMode),
    snapMode: DefaultSnapMode(storeData.snapMode),
  }
}

function gameToStoreData(game: Game): string {
  return JSON.stringify({
    id: game.id,
    rng: {
      type: game.rng.type,
      obj: Rng.serialize(game.rng.obj),
    },
    puzzle: game.puzzle,
    players: game.players,
    scoreMode: game.scoreMode,
    shapeMode: game.shapeMode,
    snapMode: game.snapMode,
  });
}

export default {
  // disk functions are deprecated
  loadGamesFromDisk,
  loadGameFromDisk,

  loadGamesFromDb,
  loadGameFromDb,
  persistGamesToDb,
  persistGameToDb,

  setDirty,
}
