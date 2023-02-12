"use strict"

import GameCommon from '../common/GameCommon'
import Protocol from '../common/Protocol'
import { Game as GameType, EncodedGame, Gui, ServerEvent } from '../common/Types'
import { EventAdapter } from './EventAdapter'
import { Game } from './Game'
import { PlayerCursors } from './PlayerCursors'
import { PlayerSettings } from './PlayerSettings'
import PuzzleGraphics from './PuzzleGraphics'
import { PuzzleStatus } from './PuzzleStatus'
import { PuzzleTable } from './PuzzleTable'
import { Sounds } from './Sounds'
import { ViewportSnapshots } from './ViewportSnapshots'
import Communication from './Communication'
import Util from '../common/Util'

export class GamePlay extends Game<Gui> {

  private updateStatusInterval: NodeJS.Timeout | null = null

  async connect(): Promise<void> {
    Communication.onConnectionStateChange((state) => {
      this.gui.setConnectionState(state)
    })

    const game: EncodedGame = await Communication.connect(this)
    const gameObject: GameType = Util.decodeGame(game)
    GameCommon.setGame(gameObject.id, gameObject)

    // rerender after (re-)connect
    this.rerender = true
  }

  unload(): void {
    if (this.updateStatusInterval) {
      clearInterval(this.updateStatusInterval)
    }
    this.stopGameLoop()
    this.unregisterEvents()

    Communication.disconnect()
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
      if (type === Protocol.INPUT_EV_MOVE) {
        const dim = this.viewport.worldDimToViewportRaw({ w: evt[1], h: evt[2] })
        this.rerender = true
        this.viewport.move(dim.w, dim.h)
        this.viewportSnapshots.remove(ViewportSnapshots.LAST)
      } else if (type === Protocol.INPUT_EV_MOUSE_MOVE) {
        const down = evt[5]
        if (down && !GameCommon.getFirstOwnedPiece(this.gameId, this.clientId)) {
          // move the cam
          const diff = this.viewport.worldDimToViewportRaw({ w: evt[3], h: evt[4] })
          this.rerender = true
          this.viewport.move(diff.w, diff.h)
          this.viewportSnapshots.remove(ViewportSnapshots.LAST)
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
        this.viewportSnapshots.remove(ViewportSnapshots.LAST)
      } else if (type === Protocol.INPUT_EV_ZOOM_OUT) {
        const pos = { x: evt[1], y: evt[2] }
        this.rerender = true
        this.viewport.zoom('out', this.viewport.worldToViewportRaw(pos))
        this.viewportSnapshots.remove(ViewportSnapshots.LAST)
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

      // LOCAL + SERVER CHANGES
      // -------------------------------------------------------------
      const ts = this.time()
      const changes = GameCommon.handleInput(this.gameId, this.clientId, evt, ts)
      if (this.playerSettings.soundsEnabled()) {
        if (changes.find(change => change[0] === Protocol.PLAYER_SNAP)) {
          this.sounds.playPieceConnected()
        }
      }
      if (changes.length > 0) {
        this.rerender = true
      }
      Communication.sendClientEvent(evt)
    }

    this.checkFinished()
  }

  async init(): Promise<void> {
    if (typeof window.DEBUG === 'undefined') window.DEBUG = false

    await this.connect()

    await this.assets.init()
    this.playerCursors = new PlayerCursors(this.canvas, this.assets)

    this.pieceDrawOffset = GameCommon.getPieceDrawOffset(this.gameId)
    const pieceDrawSize = GameCommon.getPieceDrawSize(this.gameId)
    const puzzleWidth = GameCommon.getPuzzleWidth(this.gameId)
    const puzzleHeight = GameCommon.getPuzzleHeight(this.gameId)
    this.tableWidth = GameCommon.getTableWidth(this.gameId)
    this.tableHeight = GameCommon.getTableHeight(this.gameId)

    this.boardPos = {
      x: (this.tableWidth - puzzleWidth) / 2,
      y: (this.tableHeight - puzzleHeight) / 2
    }
    this.boardDim = {
      w: puzzleWidth,
      h: puzzleHeight,
    }
    this.pieceDim = {
      w: pieceDrawSize,
      h: pieceDrawSize,
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

    this.initFireworks()

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

    this.updateStatusInterval = setInterval(() => {
      this.puzzleStatus.update(this.time())
    }, 1000)

    Communication.onServerChange((msg: ServerEvent) => {
      this.onServerEvent(msg)
    })

    this.initGameLoop()
  }
}
