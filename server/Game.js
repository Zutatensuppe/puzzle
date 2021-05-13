import GameCommon from './../common/GameCommon.js'
import Util from './../common/Util.js'
import { Rng } from '../common/Rng.js'
import GameLog from './GameLog.js'
import { createPuzzle } from './Puzzle.js'
import Protocol from '../common/Protocol.js'
import GameStorage from './GameStorage.js'

async function createGameObject(gameId, targetTiles, image, ts, scoreMode) {
  const seed = Util.hash(gameId + ' ' + ts)
  const rng = new Rng(seed)
  return {
    id: gameId,
    rng: { type: 'Rng', obj: rng },
    puzzle: await createPuzzle(rng, targetTiles, image, ts),
    players: [],
    evtInfos: {},
    scoreMode,
  }
}

async function createGame(gameId, targetTiles, image, ts, scoreMode) {
  const gameObject = await createGameObject(gameId, targetTiles, image, ts, scoreMode)

  GameLog.create(gameId)
  GameLog.log(gameId, Protocol.LOG_HEADER, 1, targetTiles, image, ts, scoreMode)

  GameCommon.setGame(gameObject.id, gameObject)
  GameStorage.setDirty(gameId)
}

function addPlayer(gameId, playerId, ts) {
  const idx = GameCommon.getPlayerIndexById(gameId, playerId)
  const diff = ts - GameCommon.getStartTs(gameId)
  if (idx === -1) {
    GameLog.log(gameId, Protocol.LOG_ADD_PLAYER, playerId, diff)
  } else {
    GameLog.log(gameId, Protocol.LOG_UPDATE_PLAYER, idx, diff)
  }

  GameCommon.addPlayer(gameId, playerId, ts)
  GameStorage.setDirty(gameId)
}

function handleInput(gameId, playerId, input, ts) {
  const idx = GameCommon.getPlayerIndexById(gameId, playerId)
  const diff = ts - GameCommon.getStartTs(gameId)
  GameLog.log(gameId, Protocol.LOG_HANDLE_INPUT, idx, input, diff)

  const ret = GameCommon.handleInput(gameId, playerId, input, ts)
  GameStorage.setDirty(gameId)
  return ret
}

export default {
  createGameObject,
  createGame,
  addPlayer,
  handleInput,
  getAllGames: GameCommon.getAllGames,
  getActivePlayers: GameCommon.getActivePlayers,
  getFinishedTileCount: GameCommon.getFinishedTileCount,
  getImageUrl: GameCommon.getImageUrl,
  getTileCount: GameCommon.getTileCount,
  exists: GameCommon.exists,
  playerExists: GameCommon.playerExists,
  get: GameCommon.get,
  getStartTs: GameCommon.getStartTs,
  getFinishTs: GameCommon.getFinishTs,
}
