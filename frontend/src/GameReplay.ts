'use strict'

import GameCommon from '../../common/src/GameCommon'
import { GAME_EVENT_TYPE, LOG_TYPE } from '../../common/src/Protocol'
import Time from '../../common/src/Time'
import type { Game as GameType, GameEvent, ReplayHud, Timestamp, HeaderLogEntry, LogEntry, EncodedPlayer } from '../../common/src/Types'
import Util from '../../common/src/Util'
import { Game } from './Game'
import { parseLogFileContents } from '../../common/src/GameLog'
import { MODE_REPLAY } from './GameMode'
import _api from './_api'

export class GameReplay extends Game<ReplayHud> {
  private final: boolean = false
  private log: LogEntry[] = []
  private logPointer: number = 0
  private speeds: number[] = [0.5, 1, 2, 5, 10, 20, 50, 100, 250, 500]
  private speedIdx: number = 1
  private paused: boolean = true
  private lastRealTs: number = 0
  private lastGameTs: number = 0
  private gameStartTs: number = 0
  private skipNonActionPhases: boolean = true
  private logFileIdx: number = 0
  private gameTs!: number
  private to: ReturnType<typeof setTimeout> | null = null

  private readonly PRELOAD_BATCHES_COUNT: number = 2
  private loadedAll: boolean = false
  private determinedBatchSize: number = 0
  private loadingPromise: Promise<void> | null = null
  private loadingResolve: (() => void) | null = null
  private nextBatches: LogEntry[][] = []

  public getMode(): string {
    return MODE_REPLAY
  }

  public shouldDrawPlayer(_player: EncodedPlayer): boolean {
    return true
  }

  public time(): number {
    return this.lastGameTs
  }

  private async prepareNextReplayBatch(): Promise<void> {
    if (
      this.loadingPromise
      || this.loadedAll
      || this.nextBatches.length >= this.PRELOAD_BATCHES_COUNT
    ) {
      return this.loadingPromise ?? Promise.resolve()
    }

    this.loadingPromise = new Promise<void>((resolve) => {
      this.loadingResolve = resolve
    })

    const logFileIdx = this.logFileIdx++

    try {
      const res = await _api.pub.replayLogData({ gameId: this.gameId, logFileIdx })
      if (res.status !== 200) {
        throw new Error('Replay not found')
      }

      const text = res.text
      const log = parseLogFileContents(text, logFileIdx)

      if (log.length === 0) {
        this.loadedAll = true
      }

      this.nextBatches.push(log)
    } finally {
      if (this.loadingResolve) {
        this.loadingResolve()
      }
      this.loadingPromise = null
      this.loadingResolve = null
    }
  }

  public async nextBatch (): Promise<LogEntry[]> {
    // if currently loading, wait for that to finish.
    if (this.loadingPromise) {
      await this.loadingPromise
    }

    const log = this.nextBatches.shift()
    if (!log) {
      throw new Error('No next batch available')
    }

    // cut log that was already handled
    this.log = this.log.slice(this.logPointer)
    this.logPointer = 0
    this.log.push(...log)

    if (log.length === 0) {
      this.final = true
    }
    return log
  }

  private async connect(): Promise<void> {
    const replayGameDataRes = await _api.pub.replayGameData({ gameId: this.gameId })
    const data = await replayGameDataRes.json()
    if ('reason' in data) {
      throw `[ 2025-05-18 ${data.reason} ]`
    }

    for (let i = 0; i < this.PRELOAD_BATCHES_COUNT; i++) {
      await this.prepareNextReplayBatch()
    }

    const logEntries: LogEntry[] = await this.nextBatch()
    if (!logEntries.length) {
      throw '[ 2023-02-12 no replay data received ]'
    }

    this.determinedBatchSize = logEntries.length

    const gameObject: GameType = Util.decodeGame(data.game)
    GameCommon.setGame(gameObject.id, gameObject)
    GameCommon.setRegisteredMap(gameObject.id, gameObject.registeredMap)

    const header = logEntries[0] as HeaderLogEntry
    this.lastRealTs = Time.timestamp()
    this.gameStartTs = header[4]
    this.lastGameTs = this.gameStartTs

    this.gameTs = this.lastGameTs

    this.requireRerender()
  }

  public doSetSpeedStatus(): void {
    this.hud.setReplaySpeed(this.speeds[this.speedIdx])
    this.hud.setReplayPaused(this.paused)
  }

  public replayOnSpeedUp(): void {
    if (this.speedIdx + 1 < this.speeds.length) {
      this.speedIdx++
      this.doSetSpeedStatus()
      this.showStatusMessage('Speed Up')
    }
  }

  public replayOnSpeedDown(): void {
    if (this.speedIdx >= 1) {
      this.speedIdx--
      this.doSetSpeedStatus()
      this.showStatusMessage('Speed Down')
    }
  }

  public replayOnPauseToggle(): void {
    this.paused = !this.paused
    this.doSetSpeedStatus()
    this.showStatusMessage(this.paused ? 'Paused' : 'Playing')
  }

  public handleEvent(evt: GameEvent): void {
    // LOCAL ONLY CHANGES
    // -------------------------------------------------------------
    const type = evt[0]
    if (type === GAME_EVENT_TYPE.INPUT_EV_REPLAY_TOGGLE_PAUSE) {
      this.replayOnPauseToggle()
    } else if (type === GAME_EVENT_TYPE.INPUT_EV_REPLAY_SPEED_DOWN) {
      this.replayOnSpeedDown()
    } else if (type === GAME_EVENT_TYPE.INPUT_EV_REPLAY_SPEED_UP) {
      this.replayOnSpeedUp()
    } else {
      this.handleLocalEvent(evt)
    }
  }

  private async next() {
    // `determinedBatchSize / 2` means we will load the next batch when we have
    // processed half the current batch. This hopefully prevents stuttering
    // at higher playback speeds. It currently takes roughly 100ms to load one batch.
    // we have usually a batch size of 10000.
    if (this.logPointer + 1 + (this.determinedBatchSize / 2) >= this.log.length) {
      void this.prepareNextReplayBatch()
    }

    if (this.logPointer + 1 >= this.log.length) {
      await this.nextBatch()
    }

    const realTs = Time.timestamp()
    if (this.paused) {
      this.lastRealTs = realTs
      this.to = setTimeout(this.next.bind(this), 50)
      return
    }
    const timePassedReal = realTs - this.lastRealTs
    const timePassedGame = timePassedReal * this.speeds[this.speedIdx]
    let maxGameTs = this.lastGameTs + timePassedGame

    do {
      if (this.paused) {
        break
      }
      const nextIdx = this.logPointer + 1
      if (nextIdx >= this.log.length) {
        break
      }
      const currLogEntry = this.log[this.logPointer]
      const currTs: Timestamp = this.gameTs + (
        currLogEntry[0] === LOG_TYPE.HEADER
        ? 0
        : (currLogEntry[currLogEntry.length - 1] as Timestamp)
      )

      const nextLogEntry = this.log[nextIdx]
      const diffToNext = nextLogEntry[nextLogEntry.length - 1] as Timestamp
      const nextTs: Timestamp = currTs + diffToNext
      if (nextTs > maxGameTs) {
        // next log entry is too far into the future
        if (this.skipNonActionPhases && (maxGameTs + 500 * Time.MS < nextTs)) {
          maxGameTs += diffToNext
        }
        break
      }
      this.gameTs = currTs
      if (GameCommon.handleLogEntry(this.gameId, nextLogEntry, nextTs)) {
        this.requireRerender()
      }
      this.logPointer = nextIdx
      // eslint-disable-next-line
    } while (true)
    this.lastRealTs = realTs
    this.lastGameTs = maxGameTs
    this.puzzleStatus.update(this.time())

    if (!this.final) {
      this.to = setTimeout(this.next.bind(this), 50)
    } else {
      this.hud.setReplayFinished()
    }
  }

  public unload() {
    if (this.to) {
      clearTimeout(this.to)
    }
    this.stopGameLoop()
    this.unregisterEvents()
  }

  public speedUp() {
    this.replayOnSpeedUp()
  }

  public speedDown() {
    this.replayOnSpeedDown()
  }

  public togglePause() {
    this.replayOnPauseToggle()
  }

  public unpause() {
    if (!this.paused) {
      return
    }
    this.togglePause()
  }

  public pause() {
    if (this.paused) {
      return
    }
    this.togglePause()
  }

  public async init(): Promise<void> {
    await this.connect()
    await this.initBaseProps()
    this.doSetSpeedStatus()
    await this.next()
    this.initGameLoop()
  }
}
