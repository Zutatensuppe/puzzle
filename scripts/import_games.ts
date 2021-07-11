import GameCommon from '../src/common/GameCommon'
import { Game } from '../src/common/Types'
import { logger } from '../src/common/Util'
import { DB_FILE, DB_PATCHES_DIR } from '../src/server/Dirs'
import Db from '../src/server/Db'
import GameStorage from '../src/server/GameStorage'

const log = logger('import_games.ts')

console.log(DB_FILE)

const db = new Db(DB_FILE, DB_PATCHES_DIR)
db.patch(true)

function run() {
  GameStorage.loadGamesFromDisk()
  GameCommon.getAllGames().forEach((game: Game) => {
    if (!game.puzzle.info.image?.id) {
      log.error(game.id + " has no image")
      log.error(game.puzzle.info.image)
      return
    }
    GameStorage.persistGameToDb(db, game.id)
  })
}

run()
