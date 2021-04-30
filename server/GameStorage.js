import fs from 'fs'
import GameCommon from './../common/GameCommon.js'
import Util, { logger } from './../common/Util.js'
import { Rng } from '../common/Rng.js'
import { DATA_DIR } from './Dirs.js'
import Time from '../common/Time.js'

const log = logger('GameStorage.js')

const DIRTY_GAMES = {}
function setDirty(gameId) {
  DIRTY_GAMES[gameId] = true
}
function setClean(gameId) {
  delete DIRTY_GAMES[gameId]
}

function loadGames() {
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
    game.puzzle.data.finished = unfinished ? 0 : Time.timestamp()
  }
  if (!Array.isArray(game.players)) {
    game.players = Object.values(game.players)
  }
  const gameObject = {
    id: game.id,
    rng: {
      type: game.rng ? game.rng.type : '_fake_',
      obj: game.rng ? Rng.unserialize(game.rng.obj) : new Rng(),
    },
    puzzle: game.puzzle,
    players: game.players,
    evtInfos: {},
    scoreMode: game.scoreMode || GameCommon.SCORE_MODE_FINAL,
  }
  GameCommon.setGame(gameObject.id, gameObject)
}

function persistGames() {
  for (const gameId of Object.keys(changedGames)) {
    persistGame(gameId)
  }
}

function persistGame(gameId) {
  const game = GameCommon.get(gameId)
  if (game.id in DIRTY_GAMES) {
    setClean(game.id)
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
  loadGames,
  loadGame,
  persistGames,
  persistGame,
  setDirty,
}
