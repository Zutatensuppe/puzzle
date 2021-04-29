import fs from 'fs'
import GameCommon from './../common/GameCommon.js'
import Util, { logger } from './../common/Util.js'
import { Rng } from '../common/Rng.js'
import GameLog from './GameLog.js'
import { createPuzzle } from './Puzzle.js'
import Protocol from '../common/Protocol.js'
import { DATA_DIR } from './Dirs.js'

const log = logger('Game.js')

function loadAllGames() {
  const files = fs.readdirSync(DATA_DIR)
  for (const f of files) {
    const m = f.match(/^([a-z0-9]+)\.json$/)
    if (!m) {
      continue
    }
    const gameId = m[1]
    loadGame(gameId)
  }
}

function loadGame(gameId) {
  const file = `${DATA_DIR}/${gameId}.json`
  const contents = fs.readFileSync(file, 'utf-8')
  let game
  try {
    game = JSON.parse(contents)
  } catch {
    log.log(`[ERR] unable to load game from file ${file}`);
  }
  if (typeof game.puzzle.data.started === 'undefined') {
    game.puzzle.data.started = Math.round(fs.statSync(file).ctimeMs)
  }
  if (typeof game.puzzle.data.finished === 'undefined') {
    let unfinished = game.puzzle.tiles.map(Util.decodeTile).find(t => t.owner !== -1)
    game.puzzle.data.finished = unfinished ? 0 : Util.timestamp()
  }
  if (!Array.isArray(game.players)) {
    game.players = Object.values(game.players)
  }
  GameCommon.newGame({
    id: game.id,
    rng: {
      type: game.rng ? game.rng.type : '_fake_',
      obj: game.rng ? Rng.unserialize(game.rng.obj) : new Rng(),
    },
    puzzle: game.puzzle,
    players: game.players,
    evtInfos: {},
    scoreMode: game.scoreMode || GameCommon.SCORE_MODE_FINAL,
  })
}

const changedGames = {}
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
  GameLog.create(gameId)
  GameLog.log(gameId, Protocol.LOG_HEADER, 1, targetTiles, image, ts, scoreMode)

  const seed = Util.hash(gameId + ' ' + ts)
  const rng = new Rng(seed)
  GameCommon.newGame({
    id: gameId,
    rng: { type: 'Rng', obj: rng },
    puzzle: await createPuzzle(rng, targetTiles, image, ts),
    players: [],
    evtInfos: {},
    scoreMode,
  })

  changedGames[gameId] = true
}

function addPlayer(gameId, playerId, ts) {
  const idx = GameCommon.getPlayerIndexById(gameId, playerId)
  if (idx === -1) {
    const diff = ts - GameCommon.getStartTs(gameId)
    GameLog.log(gameId, Protocol.LOG_ADD_PLAYER, playerId, diff)
  } else {
    const diff = ts - GameCommon.getStartTs(gameId)
    GameLog.log(gameId, Protocol.LOG_UPDATE_PLAYER, idx, diff)
  }

  GameCommon.addPlayer(gameId, playerId, ts)
  changedGames[gameId] = true
}

function handleInput(gameId, playerId, input, ts) {
  const idx = GameCommon.getPlayerIndexById(gameId, playerId)
  const diff = ts - GameCommon.getStartTs(gameId)
  GameLog.log(gameId, Protocol.LOG_HANDLE_INPUT, idx, input, diff)

  const ret = GameCommon.handleInput(gameId, playerId, input, ts)
  changedGames[gameId] = true
  return ret
}

function persistChangedGames() {
  for (const gameId of Object.keys(changedGames)) {
    persistGame(gameId)
  }
}

function persistGame(gameId) {
  const game = GameCommon.get(gameId)
  if (game.id in changedGames) {
    delete changedGames[game.id]
  }
  fs.writeFileSync(`${DATA_DIR}/${game.id}.json`, JSON.stringify({
    id: game.id,
    rng: {
      type: game.rng.type,
      obj: Rng.serialize(game.rng.obj),
    },
    puzzle: game.puzzle,
    players: game.players,
    scoreMode: game.scoreMode,
  }))
  log.info(`[INFO] persisted game ${game.id}`)
}

export default {
  createGameObject,
  loadAllGames,
  loadGame,
  persistChangedGames,
  persistGame,
  createGame,
  addPlayer,
  handleInput,
  getAllGames: GameCommon.getAllGames,
  getRelevantPlayers: GameCommon.getRelevantPlayers,
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
