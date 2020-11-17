import { createPuzzle } from './Puzzle.js'
import GameCommon from './../common/GameCommon.js'

async function createGame(gameId, targetTiles, image) {
  const game = {
    puzzle: await createPuzzle(targetTiles, image),
    players: {},

    sockets: [],
    evtInfos: {},
  }
  GameCommon.setGame(gameId, game)
}

export default {
  createGame,
  exists: GameCommon.exists,
  addPlayer: GameCommon.addPlayer,
  addSocket: GameCommon.addSocket,
  get: GameCommon.get,
  getSockets: GameCommon.getSockets,
  handleInput: GameCommon.handleInput,
}
