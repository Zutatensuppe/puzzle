import fs from 'fs'
import { createPuzzle } from './Puzzle.js'
import GameCommon from './../common/GameCommon.js'
import Util from './../common/Util.js'

const DATA_DIR = './../data'

function loadAllGames() {
  const files = fs.readdirSync(DATA_DIR)
  for (const f of files) {
    if (!f.match(/\.json$/)) {
      continue
    }
    const file = `${DATA_DIR}/${f}`
    const contents = fs.readFileSync(file, 'utf-8')
    let game
    try {
      game = JSON.parse(contents)
    } catch {
      console.log(`[ERR] unable to load game from file ${f}`);
    }
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

const changedGames = {}
async function createGame(gameId, targetTiles, image) {
  GameCommon.newGame({
    id: gameId,
    puzzle: await createPuzzle(targetTiles, image),
    players: {},
    sockets: [],
    evtInfos: {},
  })
  changedGames[gameId] = true
}

function addPlayer(gameId, playerId) {
  GameCommon.addPlayer(gameId, playerId)
  changedGames[gameId] = true
}

function addSocket(gameId, socket) {
  GameCommon.addSocket(gameId, socket)
  changedGames[gameId] = true
}

function handleInput(gameId, playerId, input) {
  const ret = GameCommon.handleInput(gameId, playerId, input)
  changedGames[gameId] = true
  return ret
}

function persistChangedGames() {
  for (const game of GameCommon.getAllGames()) {
    if (game.id in changedGames) {
      delete changedGames[game.id]
      fs.writeFileSync(`${DATA_DIR}/${game.id}.json`, JSON.stringify({
        id: game.id,
        puzzle: game.puzzle,
        players: game.players,
      }))
      console.info(`[INFO] persisted game ${game.id}`)
    }
  }
}

export default {
  loadAllGames,
  persistChangedGames,
  createGame,
  addPlayer,
  addSocket,
  handleInput,
  getAllGames: GameCommon.getAllGames,
  getActivePlayers: GameCommon.getActivePlayers,
  getFinishedTileCount: GameCommon.getFinishedTileCount,
  getImageUrl: GameCommon.getImageUrl,
  getTileCount: GameCommon.getTileCount,
  exists: GameCommon.exists,
  playerExists: GameCommon.playerExists,
  socketExists: GameCommon.socketExists,
  removeSocket: GameCommon.removeSocket,
  get: GameCommon.get,
  getSockets: GameCommon.getSockets,
  getStartTs: GameCommon.getStartTs,
  getFinishTs: GameCommon.getFinishTs,
}
