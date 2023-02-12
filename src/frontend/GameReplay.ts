
import fireworksController from './Fireworks'
import GameCommon from '../common/GameCommon'
import Protocol from '../common/Protocol'
import Time from '../common/Time'
import { Game as GameType, Player, ReplayData, ReplayGui, Timestamp } from '../common/Types'
import Util from '../common/Util'
import { EventAdapter } from './EventAdapter'
import { Game } from './Game'
import { MODE_REPLAY } from './GameMode'
import { PlayerCursors } from './PlayerCursors'
import { PlayerSettings } from './PlayerSettings'
import PuzzleGraphics from './PuzzleGraphics'
import { PuzzleTable } from './PuzzleTable'
import { Sounds } from './Sounds'
import { ViewportSnapshots } from './ViewportSnapshots'
import _api from './_api'
import { PuzzleStatus } from './PuzzleStatus'

interface Replay {
  final: boolean
  log: Array<any> // current log entries
  logPointer: number // pointer to current item in the log array
  speeds: Array<number>
  speedIdx: number
  paused: boolean
  lastRealTs: number
  lastGameTs: number
  gameStartTs: number
  skipNonActionPhases: boolean
  //
  dataOffset: number
}

export class GameReplay extends Game<ReplayGui> {
  private REPLAY: Replay = {
    final: false,
    log: [],
    logPointer: 0,
    speeds: [0.5, 1, 2, 5, 10, 20, 50, 100, 250, 500],
    speedIdx: 1,
    paused: false,
    lastRealTs: 0,
    lastGameTs: 0,
    gameStartTs: 0,
    skipNonActionPhases: true,
    dataOffset: 0,
  }

  private GAME_TS!: number

  private to: NodeJS.Timeout | null = null

  getMode(): string {
    return MODE_REPLAY
  }

  shouldDrawPlayer(_player: Player): boolean {
    return true
  }

  time(): number {
    return this.REPLAY.lastGameTs
  }


  async queryNextReplayBatch (): Promise<ReplayData | null> {
    const offset = this.REPLAY.dataOffset
    this.REPLAY.dataOffset += 10000 // meh

    const res = await _api.pub.replayData({ gameId: this.gameId, offset })
    if (res.status !== 200) {
      throw new Error('Replay not found')
    }
    const replay: ReplayData = await res.json() as ReplayData

    // cut log that was already handled
    this.REPLAY.log = this.REPLAY.log.slice(this.REPLAY.logPointer)
    this.REPLAY.logPointer = 0
    this.REPLAY.log.push(...replay.log)

    if (replay.log.length === 0) {
      this.REPLAY.final = true
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

    this.REPLAY.lastRealTs = Time.timestamp()
    this.REPLAY.gameStartTs = parseInt(replay.log[0][4], 10)
    this.REPLAY.lastGameTs = this.REPLAY.gameStartTs

    this.GAME_TS = this.REPLAY.lastGameTs

    // rerender after (re-)connect
    this.rerender = true
  }

  doSetSpeedStatus(): void {
    this.gui.setReplaySpeed(this.REPLAY.speeds[this.REPLAY.speedIdx])
    this.gui.setReplayPaused(this.REPLAY.paused)
  }

  replayOnSpeedUp(): void {
    if (this.REPLAY.speedIdx + 1 < this.REPLAY.speeds.length) {
      this.REPLAY.speedIdx++
      this.doSetSpeedStatus()
      this.showStatusMessage('Speed Up')
    }
  }

  replayOnSpeedDown(): void {
    if (this.REPLAY.speedIdx >= 1) {
      this.REPLAY.speedIdx--
      this.doSetSpeedStatus()
      this.showStatusMessage('Speed Down')
    }
  }

  replayOnPauseToggle(): void {
    this.REPLAY.paused = !this.REPLAY.paused
    this.doSetSpeedStatus()
    this.showStatusMessage(this.REPLAY.paused ? 'Paused' : 'Playing')
  }

  onUpdate(): void {
    // handle key downs once per onUpdate
    // this will create Protocol.INPUT_EV_MOVE events if something
    // relevant is pressed
    this.evts.createKeyEvents()

    for (const evt of this.evts.consumeAll()) {
      // LOCAL ONLY CHANGES
      // -------------------------------------------------------------
      const type = evt[0]
      if (type === Protocol.INPUT_EV_REPLAY_TOGGLE_PAUSE) {
        this.replayOnPauseToggle()
      } else if (type === Protocol.INPUT_EV_REPLAY_SPEED_DOWN) {
        this.replayOnSpeedDown()
      } else if (type === Protocol.INPUT_EV_REPLAY_SPEED_UP) {
        this.replayOnSpeedUp()
      } else if (type === Protocol.INPUT_EV_MOVE) {
        const dim = this.viewport.worldDimToViewportRaw({ w: evt[1], h: evt[2] })
        this.rerender = true
        this.viewport.move(dim.w, dim.h)
      } else if (type === Protocol.INPUT_EV_MOUSE_MOVE) {
        const down = evt[5]
        if (down) {
          const diff = this.viewport.worldDimToViewportRaw({ w: evt[3], h: evt[4] })
          this.rerender = true
          this.viewport.move(diff.w, diff.h)
        }
      } else if (type === Protocol.INPUT_EV_PLAYER_COLOR) {
        this.playerCursors.updatePlayerCursorColor(evt[1])
      } else if (type === Protocol.INPUT_EV_MOUSE_DOWN) {
        this.playerCursors.updatePlayerCursorState(true)
      } else if (type === Protocol.INPUT_EV_MOUSE_UP) {
        this.playerCursors.updatePlayerCursorState(false)
      } else if (type === Protocol.INPUT_EV_ZOOM_IN) {
        const pos = { x: evt[1], y: evt[2] }
        this.rerender = true
        this.viewport.zoom('in', this.viewport.worldToViewportRaw(pos))
      } else if (type === Protocol.INPUT_EV_ZOOM_OUT) {
        const pos = { x: evt[1], y: evt[2] }
        this.rerender = true
        this.viewport.zoom('out', this.viewport.worldToViewportRaw(pos))
      } else if (type === Protocol.INPUT_EV_TOGGLE_INTERFACE) {
        this.emitToggleInterface()
      } else if (type === Protocol.INPUT_EV_TOGGLE_PREVIEW) {
        this.emitTogglePreview()
      } else if (type === Protocol.INPUT_EV_TOGGLE_SOUNDS) {
        this.playerSettings.toggleSoundsEnabled()
      } else if (type === Protocol.INPUT_EV_TOGGLE_PLAYER_NAMES) {
        this.playerSettings.togglePlayerNames()
      } else if (type === Protocol.INPUT_EV_CENTER_FIT_PUZZLE) {
        const slot = 'center'
        const handled = this.viewportSnapshots.handle(slot)
        this.showStatusMessage(handled ? `Restored position "${handled}"` : `Position "${slot}" not set`)
      } else if (type === Protocol.INPUT_EV_TOGGLE_FIXED_PIECES) {
        this.toggleViewFixedPieces()
      } else if (type === Protocol.INPUT_EV_TOGGLE_LOOSE_PIECES) {
        this.toggleViewLoosePieces()
      } else if (type === Protocol.INPUT_EV_TOGGLE_TABLE) {
        this.playerSettings.toggleShowTable()
      } else if (type === Protocol.INPUT_EV_STORE_POS) {
        const slot: string = `${evt[1]}`
        this.viewportSnapshots.snap(slot)
        this.showStatusMessage(`Stored position ${slot}`)
      } else if (type === Protocol.INPUT_EV_RESTORE_POS) {
        const slot: string = `${evt[1]}`
        const handled = this.viewportSnapshots.handle(slot)
        this.showStatusMessage(handled ? `Restored position "${handled}"` : `Position "${slot}" not set`)
      }
    }

    this.checkFinished()
  }

  private handleLogEntry(logEntry: any[], ts: Timestamp) {
    const entry = logEntry
    if (entry[0] === Protocol.LOG_ADD_PLAYER) {
      const playerId = entry[1]
      GameCommon.addPlayer(this.gameId, playerId, ts)
      return true
    }
    if (entry[0] === Protocol.LOG_UPDATE_PLAYER) {
      const playerId = GameCommon.getPlayerIdByIndex(this.gameId, entry[1])
      if (!playerId) {
        throw '[ 2021-05-17 player not found (update player) ]'
      }
      GameCommon.addPlayer(this.gameId, playerId, ts)
      return true
    }
    if (entry[0] === Protocol.LOG_HANDLE_INPUT) {
      const playerId = GameCommon.getPlayerIdByIndex(this.gameId, entry[1])
      if (!playerId) {
        throw '[ 2021-05-17 player not found (handle input) ]'
      }
      const input = entry[2]
      GameCommon.handleInput(this.gameId, playerId, input, ts)
      return true
    }
    return false
  }

  private async next() {
    if (this.REPLAY.logPointer + 1 >= this.REPLAY.log.length) {
      await this.queryNextReplayBatch()
    }

    const realTs = Time.timestamp()
    if (this.REPLAY.paused) {
      this.REPLAY.lastRealTs = realTs
      this.to = setTimeout(this.next.bind(this), 50)
      return
    }
    const timePassedReal = realTs - this.REPLAY.lastRealTs
    const timePassedGame = timePassedReal * this.REPLAY.speeds[this.REPLAY.speedIdx]
    let maxGameTs = this.REPLAY.lastGameTs + timePassedGame

    let continueLoop: boolean = true
    do {
      if (this.REPLAY.paused) {
        break
      }
      const nextIdx = this.REPLAY.logPointer + 1
      if (nextIdx >= this.REPLAY.log.length) {
        break
      }
      const currLogEntry = this.REPLAY.log[this.REPLAY.logPointer]
      const currTs: Timestamp = this.GAME_TS + (
        currLogEntry[0] === Protocol.LOG_HEADER
        ? 0
        : currLogEntry[currLogEntry.length - 1]
      )

      const nextLogEntry = this.REPLAY.log[nextIdx]
      const diffToNext = nextLogEntry[nextLogEntry.length - 1]
      const nextTs: Timestamp = currTs + diffToNext
      if (nextTs > maxGameTs) {
        // next log entry is too far into the future
        if (this.REPLAY.skipNonActionPhases && (maxGameTs + 500 * Time.MS < nextTs)) {
          maxGameTs += diffToNext
        }
        continueLoop = false
      } else {
        this.GAME_TS = currTs
        if (this.handleLogEntry(nextLogEntry, nextTs)) {
          this.rerender = true
        }
        this.REPLAY.logPointer = nextIdx
      }
    } while (continueLoop)
    this.REPLAY.lastRealTs = realTs
    this.REPLAY.lastGameTs = maxGameTs
    this.puzzleStatus.update(this.time())

    if (!this.REPLAY.final) {
      this.to = setTimeout(this.next.bind(this), 50)
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

  async init(): Promise<void> {
    if (typeof window.DEBUG === 'undefined') window.DEBUG = false

    await this.assets.init()

    this.playerCursors = new PlayerCursors(this.canvas, this.assets)

    await this.connect()

    const PIECE_DRAW_SIZE = GameCommon.getPieceDrawSize(this.gameId)
    this.pieceDrawOffset = GameCommon.getPieceDrawOffset(this.gameId)
    const PUZZLE_WIDTH = GameCommon.getPuzzleWidth(this.gameId)
    const PUZZLE_HEIGHT = GameCommon.getPuzzleHeight(this.gameId)
    this.tableWidth = GameCommon.getTableWidth(this.gameId)
    this.tableHeight = GameCommon.getTableHeight(this.gameId)

    this.boardPos = {
      x: (this.tableWidth - PUZZLE_WIDTH) / 2,
      y: (this.tableHeight - PUZZLE_HEIGHT) / 2
    }
    this.boardDim = {
      w: PUZZLE_WIDTH,
      h: PUZZLE_HEIGHT,
    }
    this.pieceDim = {
      w: PIECE_DRAW_SIZE,
      h: PIECE_DRAW_SIZE,
    }

    this.tableBounds = GameCommon.getBounds(this.gameId)
    this.puzzleTable = new PuzzleTable(this.tableBounds, this.assets, this.boardPos, this.boardDim)
    await this.puzzleTable.init()

    this.bitmaps = await PuzzleGraphics.loadPuzzleBitmaps(
      GameCommon.getPuzzle(this.gameId),
      GameCommon.getImageUrl(this.gameId),
    )

    this.evts = new EventAdapter(this)
    this.viewportSnapshots = new ViewportSnapshots(this.evts, this.viewport)
    this.playerSettings = new PlayerSettings(this)
    this.playerSettings.init()
    this.sounds = new Sounds(this.assets, this.playerSettings)

    this.fireworks = new fireworksController(this.canvas, GameCommon.getRng(this.gameId))
    this.fireworks.init()

    this.canvas.classList.add('loaded')
    this.gui.setPuzzleCut()

    // initialize some view data
    // this global data will change according to input events

    // theoretically we need to recalculate this when window resizes
    // but it probably doesnt matter so much
    this.viewport.calculateZoomCapping(
      window.innerWidth,
      window.innerHeight,
      this.tableWidth,
      this.tableHeight,
    )

    this.evts.registerEvents()

    this.centerPuzzle()
    this.viewportSnapshots.snap('center')

    this.puzzleStatus = new PuzzleStatus(this)
    this.puzzleStatus.update(this.time())

    this.initFinishState()

    this.evts.addEvent([Protocol.INPUT_EV_BG_COLOR, this.playerSettings.background()])
    this.evts.addEvent([Protocol.INPUT_EV_PLAYER_COLOR, this.playerSettings.color()])
    this.evts.addEvent([Protocol.INPUT_EV_PLAYER_NAME, this.playerSettings.name()])

    this.playerCursors.updatePlayerCursorColor(this.playerSettings.color())

    this.doSetSpeedStatus()

    this.next()

    this.initGameLoop()
  }
}
