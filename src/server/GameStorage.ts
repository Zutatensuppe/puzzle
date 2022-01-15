import GameCommon from './../common/GameCommon'
import { DefaultScoreMode, DefaultShapeMode, DefaultSnapMode, Game } from './../common/Types'
import { logger } from './../common/Util'
import { Rng } from './../common/Rng'
import Db from './Db'
import GameLog from './GameLog'

const log = logger('GameStorage.js')

const dirtyGames: Record<string, boolean> = {}
function setDirty(gameId: string): void {
  dirtyGames[gameId] = true
}
function setClean(gameId: string): void {
  delete dirtyGames[gameId]
}

function gameRowToGameObject(gameRow: any): Game | null {
  let game
  try {
    game = JSON.parse(gameRow.data)
  } catch {
    return null
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

  const gameObject: Game = storeDataToGame(game, game.creator_user_id, !!game.private)
  gameObject.hasReplay = GameLog.hasReplay(gameObject)
  return gameObject
}

function loadGameFromDb(db: Db, gameId: string): boolean {
  log.info(`[INFO] loading game from db: ${gameId}`);
  const gameRow = db.get('games', {id: gameId})
  if (!gameRow) {
    log.info(`[INFO] game not found in db: ${gameId}`);
    return false
  }

  const gameObject = gameRowToGameObject(gameRow)
  if (!gameObject) {
    log.error(`[ERR] unable to turn game row into game object: ${gameRow.id}`);
    return false
  }

  GameCommon.setGame(gameObject.id, gameObject)
  return true
}

function getAllPublicGames(db: Db): Game[] {
  const gameRows = db.getMany('games', { private: 0 })
  const games: Game[] = []
  for (const gameRow of gameRows) {
    const gameObject = gameRowToGameObject(gameRow)
    if (!gameObject) {
      log.error(`[ERR] unable to turn game row into game object: ${gameRow.id}`);
      continue
    }
    games.push(gameObject)
  }
  return games
}

function unloadGame(gameId: string): void {
  log.info(`[INFO] unloading game: ${gameId}`);
  GameCommon.unsetGame(gameId)
}

function exists(db: Db, gameId: string): boolean {
  const gameRow = db.get('games', {id: gameId})
  return !!gameRow
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

    data: gameToStoreData(game),

    private: game.private ? 1 : 0,
  }, {
    id: game.id,
  })
  log.info(`[INFO] persisted game ${game.id}`)
}

function storeDataToGame(storeData: any, creatorUserId: number|null, isPrivate: boolean): Game {
  return {
    id: storeData.id,
    gameVersion: storeData.gameVersion || 1, // old games didnt have this stored
    creatorUserId,
    rng: {
      type: storeData.rng ? storeData.rng.type : '_fake_',
      obj: storeData.rng ? Rng.unserialize(storeData.rng.obj) : new Rng(0),
    },
    puzzle: storeData.puzzle,
    players: storeData.players,
    scoreMode: DefaultScoreMode(storeData.scoreMode),
    shapeMode: DefaultShapeMode(storeData.shapeMode),
    snapMode: DefaultSnapMode(storeData.snapMode),
    hasReplay: !!storeData.hasReplay,
    private: isPrivate,
  }
}

function gameToStoreData(game: Game): string {
  return JSON.stringify({
    id: game.id,
    gameVersion: game.gameVersion,
    rng: {
      type: game.rng.type,
      obj: Rng.serialize(game.rng.obj),
    },
    puzzle: game.puzzle,
    players: game.players,
    scoreMode: game.scoreMode,
    shapeMode: game.shapeMode,
    snapMode: game.snapMode,
    hasReplay: game.hasReplay,
  });
}

export default {
  loadGameFromDb,
  persistGamesToDb,
  persistGameToDb,

  getAllPublicGames,
  unloadGame,

  exists,

  setDirty,
}
