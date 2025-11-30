import type { Server } from '../Server'

export abstract class Worker {
  private timeout: any = null
  private boundRun: () => Promise<void>

  constructor(
    protected readonly server: Server,
  ) {
    this.boundRun = this.run.bind(this)
  }

  protected abstract work(): Promise<{ nextExecution?: number }>

  public stop(): void {
    if (this.timeout) {
      clearTimeout(this.timeout)
    }
  }

  public async run(): Promise<void> {
    this.stop()

    try {
      const result = await this.work()
      if (result.nextExecution) {
        this.timeout = setTimeout(this.boundRun, result.nextExecution)
      } else {
        this.timeout = null
      }
    } catch (err) {
      console.error(`[${this.constructor.name}] worker failed:`, err)
      this.timeout = setTimeout(this.boundRun, 60_000) // retry in 1 min
    }
  }
}
