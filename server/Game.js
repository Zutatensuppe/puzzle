import fs from 'fs'
import { createPuzzle } from './Puzzle.js'
import GameCommon from './../common/GameCommon.js'
import Util from './../common/Util.js'

async function createGame(gameId, targetTiles, image) {
  GameCommon.newGame({
    id: gameId,
    puzzle: await createPuzzle(targetTiles, image),
    players: {},
    sockets: [],
    evtInfos: {},
  })
}

const DATA_DIR = './../data'

function loadAllGames() {
  const files = fs.readdirSync(DATA_DIR)
  for (const f of files) {
    if (!f.match(/\.json$/)) {
      continue
    }
    const file = `${DATA_DIR}/${f}`
    const contents = fs.readFileSync(file, 'utf-8')
    const game = JSON.parse(contents)
    if (typeof game.puzzle.data.started === 'undefined') {
      game.puzzle.data.started = Math.round(fs.statSync(file).ctimeMs)
    }
    if (typeof game.puzzle.data.finished === 'undefined') {
      let unfinished = game.puzzle.tiles.map(Util.decodeTile).find(t => t.owner !== -1)
      game.puzzle.data.finished = unfinished ? 0 : Util.timestamp()
    }
    GameCommon.newGame({
      id: game.id,
      puzzle: game.puzzle,
      players: game.players,
      sockets: [],
      evtInfos: {}
    })
  }
}

function persistAll() {
  for (const game of GameCommon.getAllGames()) {
    fs.writeFileSync(`${DATA_DIR}/${game.id}.json`, JSON.stringify({
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
  getStartTs: GameCommon.getStartTs,
  getFinishTs: GameCommon.getFinishTs,
}
