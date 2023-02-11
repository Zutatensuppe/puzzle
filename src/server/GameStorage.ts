import {
  DefaultScoreMode, DefaultShapeMode, DefaultSnapMode, Game, Puzzle,
  EncodedPlayer, ScoreMode, ShapeMode, SnapMode
} from './../common/Types'
import { logger } from './../common/Util'
import { Rng, RngSerialized } from './../common/Rng'
import Db from './Db'
import GameLog from './GameLog'
import { Rect } from '../common/Geometry'

const log = logger('GameStorage.js')

interface GameRow {
  id: string
  creator_user_id: number
  image_id: number
  created: Date
  finished: Date | null
  data: string
  private: number
}

interface GameStoreData {
  id: string
  gameVersion: number
  rng: {
    type?: string
    obj: RngSerialized
  }
  puzzle: Puzzle
  players: EncodedPlayer[]
  scoreMode: ScoreMode
  shapeMode: ShapeMode
  snapMode: SnapMode
  hasReplay: boolean
  crop?: Rect
}

const dirtyGames: Record<string, boolean> = {}
function setDirty(gameId: string): void {
  dirtyGames[gameId] = true
}
function setClean(gameId: string): void {
  if (gameId in dirtyGames) {
    delete dirtyGames[gameId]
  }
}

function gameRowToGameObject(gameRow: GameRow): Game | null {
  let game: GameStoreData
  try {
    game = JSON.parse(gameRow.data)
  } catch {
    return null
  }
  if (typeof game.puzzle.data.started === 'undefined') {
    game.puzzle.data.started = gameRow.created.getTime()
  }
  if (typeof game.puzzle.data.finished === 'undefined') {
    game.puzzle.data.finished = gameRow.finished ? gameRow.finished.getTime() : 0
  }
  if (!Array.isArray(game.players)) {
    game.players = Object.values(game.players)
  }

  const gameObject: Game = storeDataToGame(
    game,
    gameRow.creator_user_id,
    !!gameRow.private
  )
  gameObject.hasReplay = GameLog.hasReplay(gameObject)
  gameObject.crop = game.crop
  return gameObject
}

async function getGameRowById(db: Db, gameId: string): Promise<GameRow | null> {
  const gameRow = await db.get('games', {id: gameId})
  return (gameRow as GameRow) || null
}

async function loadGame(db: Db, gameId: string): Promise<Game | null> {
  log.info(`[INFO] loading game: ${gameId}`);
  const gameRow = await getGameRowById(db, gameId)
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

const gameRowsToGames = (gameRows: GameRow[]): Game[] => {
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

async function getPublicRunningGames(db: Db, offset: number, limit: number): Promise<Game[]> {
  const gameRows = await db.getMany(
    'games',
    { private: 0, finished: null },
    [{ created: -1 }],
    { limit, offset }
  ) as GameRow[]
  return gameRowsToGames(gameRows)
}

async function getPublicFinishedGames(db: Db, offset: number, limit: number): Promise<Game[]> {
  const gameRows = await db.getMany(
    'games',
    { private: 0, finished: { '$ne': null } },
    [{ finished: -1 }],
    { limit, offset }
  ) as GameRow[]
  return gameRowsToGames(gameRows)
}

async function countPublicRunningGames(db: Db): Promise<number> {
  return await db.count('games', { private: 0, finished: null })
}

async function countPublicFinishedGames(db: Db): Promise<number> {
  return await db.count('games', { private: 0, finished: { '$ne': null } })
}

async function exists(db: Db, gameId: string): Promise<boolean> {
  const gameRow = await getGameRowById(db, gameId)
  return !!gameRow
}

function dirtyGameIds(): string[] {
  return Object.keys(dirtyGames)
}

async function persistGame(db: Db, game: Game): Promise<void> {
  setClean(game.id)

  await db.upsert('games', {
    id: game.id,
    creator_user_id: game.creatorUserId,
    image_id: game.puzzle.info.image?.id,
    created: new Date(game.puzzle.data.started),
    finished: game.puzzle.data.finished ? new Date(game.puzzle.data.finished) : null,
    data: JSON.stringify(gameToStoreData(game)),
    private: game.private ? 1 : 0,
  }, {
    id: game.id,
  })
  log.info(`[INFO] persisted game ${game.id}`)
}

function storeDataToGame(
  storeData: GameStoreData,
  creatorUserId: number|null,
  isPrivate: boolean,
): Game {
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

function gameToStoreData(game: Game): GameStoreData {
  return {
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
    crop: game.crop,
  };
}

export default {
  persistGame,

  loadGame,

  getPublicRunningGames,
  getPublicFinishedGames,

  countPublicRunningGames,
  countPublicFinishedGames,

  exists,

  setDirty,
  dirtyGameIds,
}
