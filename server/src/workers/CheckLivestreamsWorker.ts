import Time from '@common/Time'
import { logger } from '@common/Util'
import { Worker } from './Worker'

const log = logger('CheckLivestreamsWorker.ts')

export class CheckLivestreamsWorker extends Worker {
  async work(): Promise<{ nextExecution?: number }> {
    log.log('Checking for livestreams...')

    await this.server.updateLivestreamsInfo()

    return { nextExecution: 1 * Time.MIN }
  }
}
