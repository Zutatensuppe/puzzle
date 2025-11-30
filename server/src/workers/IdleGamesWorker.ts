import config from '../Config'
import GameCommon from '../../../common/src/GameCommon'
import GameLog from '../GameLog'
import { logger } from '../../../common/src/Util'
import { Worker } from './Worker'

const log = logger('IdleGamesWorker.ts')

export class IdleGamesWorker extends Worker {
  async work(): Promise<{ nextExecution?: number }> {
    log.log('Checking idle games...')

    const idleGameIds = this.server.gameSockets.updateIdle()
    for (const gameId of idleGameIds) {
      await this.server.persistGame(gameId)
      log.info(`[INFO] unloading game: ${gameId}`)
      GameCommon.unsetGame(gameId)
      GameLog.unsetGame(gameId)
      this.server.gameSockets.removeSocketInfo(gameId)
    }
    return { nextExecution: config.idlecheck.interval }
  }
}
