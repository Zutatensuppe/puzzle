import { logger } from '../common/src/Util'
import config from '../server/src/Config'
import Db from '../server/src/Db'
import { LeaderboardRepo } from '../server/src/repo/LeaderboardRepo'

const log = logger()

const db = new Db(config.db.connectStr, config.dir.DB_PATCHES_DIR)

;(async () => {
  await db.connect()
  await db.patch(true)

  const userRows = await db.getMany('users')
  const gameRows = await db.getMany('games')
  for (const gameRow of gameRows) {
    const data = JSON.parse(gameRow.data)
    await db.update('games', { pieces_count: data.puzzle.tiles.length }, { id: gameRow.id })
    for (const player of data.players) {
      const clientId = player[0]
      const userRow = userRows.find(u => u.client_id === clientId)
      if (userRow) {
        if (userRow.name === '' || userRow.name === null) {
          await db.upsert('users', { name: player[4] }, { id: userRow.id })
        }
        // log.info(player)
        const userXgame = { user_id: userRow.id, game_id: gameRow.id, pieces_count: player[7] }
        await db.upsert('user_x_game', userXgame, { user_id: userRow.id, game_id: gameRow.id })
      }
    }
  }
  const repo = new LeaderboardRepo(db)
  await repo.updateLeaderboards()

  await db.close()
})()
