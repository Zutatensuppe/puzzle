import config from '../Config'
import { logger } from '../../../common/src/Util'
import { Worker } from './Worker'

const log = logger('PersistGamesWorker.ts')

export class PersistGamesWorker extends Worker {
  async work(): Promise<{ nextExecution?: number }> {
    log.log('Persisting games...')
    await this.server.persistGames()
    this.server.logMemoryUsageHuman()
    return { nextExecution: config.persistence.interval }
  }
}
