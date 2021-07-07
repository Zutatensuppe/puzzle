import fs from 'fs'
import GameCommon from './../common/GameCommon'
import { DefaultScoreMode, DefaultShapeMode, DefaultSnapMode, Game, Piece } from './../common/Types'
import Util, { logger } from './../common/Util'
import { Rng } from './../common/Rng'
import { DATA_DIR } from './Dirs'
import Time from './../common/Time'

const log = logger('GameStorage.js')

const dirtyGames: Record<string, boolean> = {}
function setDirty(gameId: string): void {
  dirtyGames[gameId] = true
}
function setClean(gameId: string): void {
  delete dirtyGames[gameId]
}

function loadGames(): void {
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

function loadGame(gameId: string): void {
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
    const unfinished = game.puzzle.tiles
      .map(Util.decodePiece)
      .find((t: Piece) => t.owner !== -1)
    game.puzzle.data.finished = unfinished ? 0 : Time.timestamp()
  }
  if (!Array.isArray(game.players)) {
    game.players = Object.values(game.players)
  }
  const gameObject: Game = {
    id: game.id,
    rng: {
      type: game.rng ? game.rng.type : '_fake_',
      obj: game.rng ? Rng.unserialize(game.rng.obj) : new Rng(0),
    },
    puzzle: game.puzzle,
    players: game.players,
    evtInfos: {},
    scoreMode: DefaultScoreMode(game.scoreMode),
    shapeMode: DefaultShapeMode(game.shapeMode),
    snapMode: DefaultSnapMode(game.snapMode),
  }
  GameCommon.setGame(gameObject.id, gameObject)
}

function persistGames(): void {
  for (const gameId of Object.keys(dirtyGames)) {
    persistGame(gameId)
  }
}

function persistGame(gameId: string): void {
  const game = GameCommon.get(gameId)
  if (!game) {
    log.error(`[ERROR] unable to persist non existing game ${gameId}`)
    return
  }

  if (game.id in dirtyGames) {
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
    shapeMode: game.shapeMode,
    snapMode: game.snapMode,
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
