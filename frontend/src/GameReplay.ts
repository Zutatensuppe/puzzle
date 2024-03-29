'use strict'

import GameCommon from '../../common/src/GameCommon'
import { GAME_EVENT_TYPE, LOG_TYPE } from '../../common/src/Protocol'
import Time from '../../common/src/Time'
import { Game as GameType, GameEvent, Player, ReplayData, ReplayHud, Timestamp, HeaderLogEntry, LogEntry } from '../../common/src/Types'
import Util from '../../common/src/Util'
import { Game } from './Game'
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
  private dataOffset: number = 0
  private gameTs!: number
  private to: number | null = null

  getMode(): string {
    return MODE_REPLAY
  }

  shouldDrawPlayer(_player: Player): boolean {
    return true
  }

  time(): number {
    return this.lastGameTs
  }

  async queryNextReplayBatch (): Promise<ReplayData | null> {
    const offset = this.dataOffset
    this.dataOffset += 10000 // meh

    const res = await _api.pub.replayData({ gameId: this.gameId, offset })
    if (res.status !== 200) {
      throw new Error('Replay not found')
    }
    const replay: ReplayData = await res.json() as ReplayData

    // cut log that was already handled
    this.log = this.log.slice(this.logPointer)
    this.logPointer = 0
    this.log.push(...replay.log)

    if (replay.log.length === 0) {
      this.final = true
    }
    return replay
  }

  async connect(): Promise<void> {
    const replay: ReplayData | null = await this.queryNextReplayBatch()
    if (!replay) {
      throw '[ 2023-02-12 no replay data received ]'
    }
    if (!replay.game) {
      throw '[ 2021-05-29 no game received ]'
    }
    const gameObject: GameType = Util.decodeGame(replay.game)
    GameCommon.setGame(gameObject.id, gameObject)
    GameCommon.setRegisteredMap(gameObject.id, gameObject.registeredMap)

    const header = replay.log[0] as HeaderLogEntry
    this.lastRealTs = Time.timestamp()
    this.gameStartTs = header[4]
    this.lastGameTs = this.gameStartTs

    this.gameTs = this.lastGameTs

    this.requireRerender()
  }

  doSetSpeedStatus(): void {
    this.hud.setReplaySpeed(this.speeds[this.speedIdx])
    this.hud.setReplayPaused(this.paused)
  }

  replayOnSpeedUp(): void {
    if (this.speedIdx + 1 < this.speeds.length) {
      this.speedIdx++
      this.doSetSpeedStatus()
      this.showStatusMessage('Speed Up')
    }
  }

  replayOnSpeedDown(): void {
    if (this.speedIdx >= 1) {
      this.speedIdx--
      this.doSetSpeedStatus()
      this.showStatusMessage('Speed Down')
    }
  }

  replayOnPauseToggle(): void {
    this.paused = !this.paused
    this.doSetSpeedStatus()
    this.showStatusMessage(this.paused ? 'Paused' : 'Playing')
  }

  handleEvent(evt: GameEvent): void {
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

  unload() {
    if (this.to) {
      clearTimeout(this.to)
    }
    this.stopGameLoop()
    this.unregisterEvents()
  }

  speedUp() {
    this.replayOnSpeedUp()
  }

  speedDown() {
    this.replayOnSpeedDown()
  }

  togglePause() {
    this.replayOnPauseToggle()
  }

  unpause() {
    if (!this.paused) {
      return
    }
    this.togglePause()
  }

  pause() {
    if (this.paused) {
      return
    }
    this.togglePause()
  }

  async init(): Promise<void> {
    await this.connect()
    await this.initBaseProps()
    this.doSetSpeedStatus()
    this.next()
    this.initGameLoop()
  }
}
