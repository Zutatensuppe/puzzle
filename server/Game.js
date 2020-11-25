import fs from 'fs'
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

function loadAllGames() {
  const files = fs.readdirSync('./../data/')
  for (const f of files) {
    if (!f.match(/\.json$/)) {
      continue
    }
    const gameId = f.replace(/\.json$/, '')
    const contents = fs.readFileSync(`./../data/${f}`, 'utf-8')
    const game = JSON.parse(contents)
    GameCommon.setGame(gameId, {
      puzzle: game.puzzle,
      players: game.players,
      sockets: [],
      evtInfos: {},
    })
  }
}

function store(gameId) {
  const game = GameCommon.get(gameId)
  fs.writeFileSync('./../data/' + gameId + '.json', JSON.stringify({
    puzzle: game.puzzle,
    players: game.players,
  }))
}

export default {
  loadAllGames,
  getAllGames: GameCommon.getAllGames,
  store,
  createGame,
  exists: GameCommon.exists,
  addPlayer: GameCommon.addPlayer,
  addSocket: GameCommon.addSocket,
  removeSocket: GameCommon.removeSocket,
  get: GameCommon.get,
  getSockets: GameCommon.getSockets,
  handleInput: GameCommon.handleInput,
}
