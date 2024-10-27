'use strict'

import GameCommon from '../../common/src/GameCommon'
import { GAME_EVENT_TYPE, LOG_TYPE } from '../../common/src/Protocol'
import Time from '../../common/src/Time'
import { Game as GameType, GameEvent, ReplayHud, Timestamp, HeaderLogEntry, LogEntry, ReplayGameData, EncodedPlayer } from '../../common/src/Types'
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

  public getMode(): string {
    return MODE_REPLAY
  }

  public shouldDrawPlayer(_player: EncodedPlayer): boolean {
    return true
  }

  public time(): number {
    return this.lastGameTs
  }

  public async queryNextReplayBatch (): Promise<LogEntry[]> {
    const logFileIdx = this.logFileIdx
    this.logFileIdx++

    const res = await _api.pub.replayLogData({ gameId: this.gameId, logFileIdx })
    if (res.status !== 200) {
      throw new Error('Replay not found')
    }
    const text = res.text
    const log = parseLogFileContents(text, logFileIdx)

    // cut log that was already handled
    this.log = this.log.slice(this.logPointer)
    this.logPointer = 0
    this.log.push(...log)

    if (log.length === 0) {
      this.final = true
    }
    return log
  }

  public async connect(): Promise<void> {
    const replayGameDataRes = await _api.pub.replayGameData({ gameId: this.gameId })
    if (replayGameDataRes.status !== 200) {
      throw '[ 2024-04-14 no replay data received ]'
    }
    const replayGameData: ReplayGameData = await replayGameDataRes.json() as ReplayGameData
    const logEntries: LogEntry[] = await this.queryNextReplayBatch()
    if (!logEntries.length) {
      throw '[ 2023-02-12 no replay data received ]'
    }
    const gameObject: GameType = Util.decodeGame(replayGameData.game)
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
    if (this.logPointer + 1 >= this.log.length) {
      await this.queryNextReplayBatch()
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
