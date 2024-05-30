import GameCommon from '../common/src/GameCommon'
import { logger } from '../common/src/Util'
import Db from '../server/src/Db'
import config from '../server/src/Config'
import { GameService } from '../server/src/GameService'
import { GamesRepo } from '../server/src/repo/GamesRepo'
import { UsersRepo } from '../server/src/repo/UsersRepo'
import { ImagesRepo } from '../server/src/repo/ImagesRepo'
import { PuzzleService } from '../server/src/PuzzleService'
import { LeaderboardRepo } from '../server/src/repo/LeaderboardRepo'
import { Images } from '../server/src/Images'

const log = logger('fix_pieces.js')

const db = new Db(config.db.connectStr, config.dir.DB_PATCHES_DIR)

async function load(s: GameService, gameId: string) {
  const gameObject = await s.loadGame(gameId)
  if (!gameObject) {
    log.error(`Game not found: ${gameId}`)
    return
  }
  GameCommon.setGame(gameObject.id, gameObject)
}

async function persist(s: GameService, gameId: string) {
  const gameObject = GameCommon.get(gameId)
  if (!gameObject) {
    log.error(`Game not found: ${gameId}`)
    return
  }
  await s.persistGame(gameObject)
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
  const gamesRepo = new GamesRepo(db)
  const usersRepo = new UsersRepo(db)
  const imagesRepo = new ImagesRepo(db)
  const images = new Images(imagesRepo)
  const puzzleService = new PuzzleService(images)
  const leaderboardRepo = new LeaderboardRepo(db)
  const s = new GameService(gamesRepo, usersRepo, imagesRepo, puzzleService, leaderboardRepo)
  await load(s, gameId)
  if (fixPieces(gameId)) {
    await persist(s, gameId)
  }
  await db.close()
}

run(process.argv[2])
