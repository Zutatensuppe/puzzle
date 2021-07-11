import GameCommon from '../src/common/GameCommon'
import { logger } from '../src/common/Util'
import Db from '../src/server/Db'
import { DB_FILE, DB_PATCHES_DIR } from '../src/server/Dirs'
import GameStorage from '../src/server/GameStorage'

const log = logger('fix_tiles.js')

const db = new Db(DB_FILE, DB_PATCHES_DIR)
db.patch(true)

function fix_tiles(gameId) {
  GameStorage.loadGameFromDb(db, gameId)
  let changed = false
  const tiles = GameCommon.getPiecesSortedByZIndex(gameId)
  for (let tile of tiles) {
    if (tile.owner === -1) {
      const p = GameCommon.getFinalPiecePos(gameId, tile.idx)
      if (p.x === tile.pos.x && p.y === tile.pos.y) {
        // log.log('all good', tile.pos)
      } else {
        log.log('bad tile pos', tile.pos, 'should be: ', p)
        tile.pos = p
        GameCommon.setPiece(gameId, tile.idx, tile)
        changed = true
      }
    } else if (tile.owner !== 0) {
      tile.owner = 0
      log.log('unowning tile', tile.idx)
      GameCommon.setPiece(gameId, tile.idx, tile)
      changed = true
    }
  }
  if (changed) {
    GameStorage.persistGameToDb(db, gameId)
  }
}

fix_tiles(process.argv[2])
