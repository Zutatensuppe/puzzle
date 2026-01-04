import type { Server } from '../Server'
import { CheckLivestreamsWorker } from './CheckLivestreamsWorker'
import { IdleGamesWorker } from './IdleGamesWorker'
import { PersistGamesWorker } from './PersistGamesWorker'
import type { Worker } from './Worker'

export class Workers {
  private workers: Worker[] = []

  public init(server: Server): void{
    this.workers.push(new PersistGamesWorker(server))
    this.workers.push(new IdleGamesWorker(server))
    this.workers.push(new CheckLivestreamsWorker(server))
  }

  public startAll(): void {
    for (const worker of this.workers) {
      void worker.run()
    }
  }

  public stopAll(): void {
    for (const worker of this.workers) {
      worker.stop()
    }
  }
}
