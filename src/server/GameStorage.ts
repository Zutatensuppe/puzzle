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
  if (gameId in dirtyGames) {
    delete dirtyGames[gameId]
  }
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

function loadGame(db: Db, gameId: string): Game | null {
  log.info(`[INFO] loading game: ${gameId}`);
  const gameRow = db.get('games', {id: gameId})
  if (!gameRow) {
    log.info(`[INFO] game not found: ${gameId}`);
    return null
  }

  const gameObject = gameRowToGameObject(gameRow)
  if (!gameObject) {
    log.error(`[ERR] unable to turn game row into game object: ${gameRow.id}`);
    return null
  }

  return gameObject
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

function exists(db: Db, gameId: string): boolean {
  const gameRow = db.get('games', {id: gameId})
  return !!gameRow
}

function dirtyGameIds(): string[] {
  return Object.keys(dirtyGames)
}

function persistGame(db: Db, game: Game): void {
  setClean(game.id)

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
  persistGame,

  loadGame,
  getAllPublicGames,

  exists,

  setDirty,
  dirtyGameIds,
}
