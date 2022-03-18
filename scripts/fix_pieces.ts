import GameCommon from '../src/common/GameCommon'
import { logger } from '../src/common/Util'
import Db from '../src/server/Db'
import config from '../src/server/Config'
import GameStorage from '../src/server/GameStorage'

const log = logger('fix_pieces.js')

const db = new Db(config.db.connectStr, config.dir.DB_PATCHES_DIR)

async function fix_pieces(gameId: string) {
  await db.connect()
  await db.patch(true)

  const gameObject = await GameStorage.loadGame(db, gameId)
  GameCommon.setGame(gameObject.id, gameObject)
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
      piece.owner = 0
      log.log('unowning piece', piece.idx)
      GameCommon.setPiece(gameId, piece.idx, piece)
      changed = true
    }
  }
  if (changed) {
    await GameStorage.persistGame(db, GameCommon.get(gameId))
  }
  await db.close()
}

fix_pieces(process.argv[2])
