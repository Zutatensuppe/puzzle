import GameCommon from '../src/common/GameCommon'
import { logger } from '../src/common/Util'
import Db from '../src/server/Db'
import config from '../src/server/Config'
import GameStorage from '../src/server/GameStorage'

const log = logger('fix_pieces.js')

const db = new Db(config.db.connectStr, config.dir.DB_PATCHES_DIR)

async function load(gameId: string) {
  const gameObject = await GameStorage.loadGame(db, gameId)
  if (!gameObject) {
    log.error(`Game not found: ${gameId}`)
    return
  }
  GameCommon.setGame(gameObject.id, gameObject)
}

async function persist(gameId: string) {
  const gameObject = GameCommon.get(gameId)
  if (!gameObject) {
    log.error(`Game not found: ${gameId}`)
    return
  }
  await GameStorage.persistGame(db, gameObject)
}

function fixPieces(gameId: string): boolean {
  let changed = false
  const pieces = GameCommon.getPiecesSortedByZIndex(gameId)
  for (const piece of pieces) {
    if (piece.owner === -1) {
      const p = GameCommon.getFinalPiecePos(gameId, piece.idx)
      if (p.x === piece.pos.x && p.y === piece.pos.y) {
        // log.log('all good', tile.pos)
      } else {
        log.log('bad piece pos', piece.pos, 'should be: ', p)
        piece.pos = p
        GameCommon.setPiece(gameId, piece.idx, piece)
        changed = true
      }
    } else if (piece.owner !== 0) {
      log.log('unowning piece', piece.idx)
      piece.owner = 0
      GameCommon.setPiece(gameId, piece.idx, piece)
      changed = true
    }
  }
  return changed
}

async function run(gameId: string) {
  await db.connect()
  await db.patch(true)
  await load(gameId)
  if (fixPieces(gameId)) {
    await persist(gameId)
  }
  await db.close()
}

run(process.argv[2])
