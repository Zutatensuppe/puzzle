import GameCommon from './../common/GameCommon'
import { Change, Game, Input, ScoreMode, ShapeMode, SnapMode,ImageInfo, Timestamp, GameSettings } from './../common/Types'
import Util, { logger } from './../common/Util'
import { Rng } from './../common/Rng'
import GameLog from './GameLog'
import { createPuzzle } from './Puzzle'
import Protocol from './../common/Protocol'
import GameStorage from './GameStorage'
import Db from './Db'

const log = logger('Game.ts')

async function createGameObject(
  gameId: string,
  gameVersion: number,
  targetPieceCount: number,
  image: ImageInfo,
  ts: Timestamp,
  scoreMode: ScoreMode,
  shapeMode: ShapeMode,
  snapMode: SnapMode,
  creatorUserId: number|null,
  hasReplay: boolean,
  isPrivate: boolean,
): Promise<Game> {
  const seed = Util.hash(gameId + ' ' + ts)
  const rng = new Rng(seed)
  return {
    id: gameId,
    gameVersion: gameVersion,
    creatorUserId,
    rng: { type: 'Rng', obj: rng },
    puzzle: await createPuzzle(rng, targetPieceCount, image, ts, shapeMode),
    players: [],
    scoreMode,
    shapeMode,
    snapMode,
    hasReplay,
    private: isPrivate,
  }
}

async function createNewGame(
  db: Db,
  gameSettings: GameSettings,
  ts: Timestamp,
  creatorUserId: number
): Promise<string> {
  let gameId;
  do {
    gameId = Util.uniqId()
  } while (await GameStorage.exists(db, gameId))

  const gameObject = await createGameObject(
    gameId,
    Protocol.GAME_VERSION,
    gameSettings.tiles,
    gameSettings.image,
    ts,
    gameSettings.scoreMode,
    gameSettings.shapeMode,
    gameSettings.snapMode,
    creatorUserId,
    true, // hasReplay
    gameSettings.private,
  )

  GameLog.create(gameId, ts)
  GameLog.log(
    gameObject.id,
    Protocol.LOG_HEADER,
    gameObject.gameVersion,
    gameSettings.tiles,
    gameSettings.image,
    ts,
    gameObject.scoreMode,
    gameObject.shapeMode,
    gameObject.snapMode,
    gameObject.creatorUserId,
    gameObject.private ? 1 : 0,
  )

  GameCommon.setGame(gameObject.id, gameObject)
  GameStorage.setDirty(gameObject.id)

  return gameObject.id
}

function addPlayer(gameId: string, playerId: string, ts: Timestamp): void {
  if (GameLog.shouldLog(GameCommon.getFinishTs(gameId), ts)) {
    const idx = GameCommon.getPlayerIndexById(gameId, playerId)
    if (idx === -1) {
      GameLog.log(gameId, Protocol.LOG_ADD_PLAYER, playerId, ts)
    } else {
      GameLog.log(gameId, Protocol.LOG_UPDATE_PLAYER, idx, ts)
    }
  }

  GameCommon.addPlayer(gameId, playerId, ts)
  GameStorage.setDirty(gameId)
}

function handleInput(
  gameId: string,
  playerId: string,
  input: Input,
  ts: Timestamp
): Array<Change> {
  if (GameLog.shouldLog(GameCommon.getFinishTs(gameId), ts)) {
    const idx = GameCommon.getPlayerIndexById(gameId, playerId)
    GameLog.log(gameId, Protocol.LOG_HANDLE_INPUT, idx, input, ts)
  }

  const ret = GameCommon.handleInput(gameId, playerId, input, ts)
  GameStorage.setDirty(gameId)
  return ret
}

export default {
  createGameObject,
  createNewGame,
  addPlayer,
  handleInput,
}
