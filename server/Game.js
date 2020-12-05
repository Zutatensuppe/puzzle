import fs from 'fs'
import { createPuzzle } from './Puzzle.js'
import GameCommon from './../common/GameCommon.js'

async function createGame(gameId, targetTiles, image) {
  GameCommon.newGame({
    id: gameId,
    puzzle: await createPuzzle(targetTiles, image),
    players: {},
    sockets: [],
    evtInfos: {},
  })
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
    GameCommon.newGame({
      id: gameId,
      puzzle: game.puzzle,
      players: game.players,
      sockets: [],
      evtInfos: {}
    })
  }
}

function persistAll() {
  for (const game of GameCommon.getAllGames()) {
    fs.writeFileSync('./../data/' + game.id + '.json', JSON.stringify({
      id: game.id,
      puzzle: game.puzzle,
      players: game.players,
    }))
  }
}

export default {
  loadAllGames,
  persistAll,
  createGame,
  getAllGames: GameCommon.getAllGames,
  getActivePlayers: GameCommon.getActivePlayers,
  getFinishedTileCount: GameCommon.getFinishedTileCount,
  getImageUrl: GameCommon.getImageUrl,
  getTileCount: GameCommon.getTileCount,
  exists: GameCommon.exists,
  addPlayer: GameCommon.addPlayer,
  playerExists: GameCommon.playerExists,
  addSocket: GameCommon.addSocket,
  socketExists: GameCommon.socketExists,
  removeSocket: GameCommon.removeSocket,
  get: GameCommon.get,
  getSockets: GameCommon.getSockets,
  handleInput: GameCommon.handleInput,
}
