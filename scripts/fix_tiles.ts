import GameCommon from '../src/common/GameCommon'
import { logger } from '../src/common/Util'
import Db from '../src/server/Db'
import config from '../src/server/Config'
import GameStorage from '../src/server/GameStorage'

const log = logger('fix_tiles.js')

const db = new Db(config.db.connectStr, config.dir.DB_PATCHES_DIR)

async function fix_tiles(gameId: string) {
  await db.connect()
  await db.patch(true)

  const gameObject = await GameStorage.loadGame(db, gameId)
  GameCommon.setGame(gameObject.id, gameObject)
  let changed = false
  const tiles = GameCommon.getPiecesSortedByZIndex(gameId)
  for (const tile of tiles) {
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
    await GameStorage.persistGame(db, GameCommon.get(gameId))
  }
  await db.close()
}

fix_tiles(process.argv[2])
