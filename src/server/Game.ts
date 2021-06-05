import GameCommon from './../common/GameCommon'
import { Change, Game, Input, ScoreMode, ShapeMode, SnapMode, Timestamp } from './../common/Types'
import Util, { logger } from './../common/Util'
import { Rng } from './../common/Rng'
import GameLog from './GameLog'
import { createPuzzle, PuzzleCreationImageInfo } from './Puzzle'
import Protocol from './../common/Protocol'
import GameStorage from './GameStorage'

const log = logger('Game.ts')

async function createGameObject(
  gameId: string,
  targetTiles: number,
  image: PuzzleCreationImageInfo,
  ts: Timestamp,
  scoreMode: ScoreMode,
  shapeMode: ShapeMode,
  snapMode: SnapMode
): Promise<Game> {
  const seed = Util.hash(gameId + ' ' + ts)
  const rng = new Rng(seed)
  return {
    id: gameId,
    rng: { type: 'Rng', obj: rng },
    puzzle: await createPuzzle(rng, targetTiles, image, ts, shapeMode),
    players: [],
    evtInfos: {},
    scoreMode,
    shapeMode,
    snapMode,
  }
}

async function createGame(
  gameId: string,
  targetTiles: number,
  image: PuzzleCreationImageInfo,
  ts: Timestamp,
  scoreMode: ScoreMode,
  shapeMode: ShapeMode,
  snapMode: SnapMode
): Promise<void> {
  const gameObject = await createGameObject(
    gameId,
    targetTiles,
    image,
    ts,
    scoreMode,
    shapeMode,
    snapMode
  )

  GameLog.create(gameId)
  GameLog.log(
    gameId,
    Protocol.LOG_HEADER,
    1,
    targetTiles,
    image,
    ts,
    scoreMode,
    shapeMode,
    snapMode
  )

  GameCommon.setGame(gameObject.id, gameObject)
  GameStorage.setDirty(gameId)
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
  createGame,
  addPlayer,
  handleInput,
}
