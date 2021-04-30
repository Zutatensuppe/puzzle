import GameCommon from '../common/GameCommon.js'
import { logger } from '../common/Util.js'
import Game from '../server/Game.js'


const log = logger('fix_tiles.js')

function fix_tiles(gameId) {
  Game.loadGameFromFile(gameId)
  let changed = false
  const tiles = GameCommon.getTilesSortedByZIndex(gameId)
  for (let tile of tiles) {
    if (tile.owner === -1) {
      const p = GameCommon.getFinalTilePos(gameId, tile.idx)
      if (p.x === tile.pos.x && p.y === tile.pos.y) {
        // log.log('all good', tile.pos)
      } else {
        log.log('bad tile pos', tile.pos, 'should be: ', p)
        tile.pos = p
        GameCommon.setTile(gameId, tile.idx, tile)
        changed = true
      }
    } else if (tile.owner !== 0) {
      tile.owner = 0
      log.log('unowning tile', tile.idx)
      GameCommon.setTile(gameId, tile.idx, tile)
      changed = true
    }
  }
  if (changed) {
    Game.persistGame(gameId)
  }
}

fix_tiles(process.argv[2])
