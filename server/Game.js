import fs from 'fs'
import GameCommon from './../common/GameCommon.js'
import Util from './../common/Util.js'
import { Rng } from '../common/Rng.js'
import GameLog from './GameLog.js'
import { createPuzzle } from './Puzzle.js'

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
      rng: {
        type: game.rng ? game.rng.type : '_fake_',
        obj: game.rng ? Rng.unserialize(game.rng.obj) : new Rng(),
      },
      puzzle: game.puzzle,
      players: game.players,
      sockets: [],
      evtInfos: {}
    })
  }
}

const changedGames = {}
async function createGameObject(gameId, targetTiles, image, ts) {
  const seed = Util.hash(gameId + ' ' + ts)
  const rng = new Rng(seed)
  return GameCommon.__createGameObject(
    gameId,
    {
      type: 'Rng',
      obj: rng,
    },
    await createPuzzle(rng, targetTiles, image, ts),
    {},
    [],
    {}
  )
}
async function createGame(gameId, targetTiles, image, ts) {
  GameLog.create(gameId)
  GameLog.log(gameId, 'createGame', targetTiles, image, ts)

  const seed = Util.hash(gameId + ' ' + ts)
  const rng = new Rng(seed)
  GameCommon.newGame({
    id: gameId,
    rng: {
      type: 'Rng',
      obj: rng,
    },
    puzzle: await createPuzzle(rng, targetTiles, image, ts),
    players: {},
    sockets: [],
    evtInfos: {},
  })

  changedGames[gameId] = true
}

function addPlayer(gameId, playerId, ts) {
  GameLog.log(gameId, 'addPlayer', playerId, ts)
  GameCommon.addPlayer(gameId, playerId, ts)
  changedGames[gameId] = true
}

function addSocket(gameId, socket) {
  GameCommon.addSocket(gameId, socket)
  changedGames[gameId] = true
}

function handleInput(gameId, playerId, input, ts) {
  GameLog.log(gameId, 'handleInput', playerId, input, ts)

  const ret = GameCommon.handleInput(gameId, playerId, input, ts)
  changedGames[gameId] = true
  return ret
}

function persistChangedGames() {
  for (const game of GameCommon.getAllGames()) {
    if (game.id in changedGames) {
      delete changedGames[game.id]
      fs.writeFileSync(`${DATA_DIR}/${game.id}.json`, JSON.stringify({
        id: game.id,
        rng: {
          type: game.rng.type,
          obj: Rng.serialize(game.rng.obj),
        },
        puzzle: game.puzzle,
        players: game.players,
      }))
      console.info(`[INFO] persisted game ${game.id}`)
    }
  }
}

export default {
  createGameObject,
  loadAllGames,
  persistChangedGames,
  createGame,
  addPlayer,
  addSocket,
  handleInput,
  getAllGames: GameCommon.getAllGames,
  getRelevantPlayers: GameCommon.getRelevantPlayers,
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
