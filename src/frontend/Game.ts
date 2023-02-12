"use strict"

import { GameLoopInstance, run } from './gameloop'
import { Camera } from './Camera'
import Debug from './Debug'
import Util, { logger } from '../common/Util'
import GameCommon from '../common/GameCommon'
import fireworksController from './Fireworks'
import Protocol from '../common/Protocol'
import Time from '../common/Time'
import { Dim, Point, Rect } from '../common/Geometry'
import {
  FixedLengthArray,
  Player,
  Piece,
  ServerEvent,
  Hud,
  ScoreMode,
  SnapMode,
  ShapeMode,
  GameEvent,
} from '../common/Types'
import { Assets } from './Assets'
import { EventAdapter } from './EventAdapter'
import { PuzzleTable } from './PuzzleTable'
import { ViewportSnapshots } from './ViewportSnapshots'
import PuzzleGraphics from './PuzzleGraphics'
import { PlayerSettings } from './PlayerSettings'
import { Sounds } from './Sounds'
import { PuzzleStatus } from './PuzzleStatus'
import { PlayerCursors } from './PlayerCursors'
import _api from './_api'
import { MODE_PLAY } from './GameMode'
declare global {
  interface Window {
      DEBUG?: boolean
  }
}

const log = logger('Game.ts')

export abstract class Game<HudType extends Hud> {
  protected rerender: boolean = true
  private ctx: CanvasRenderingContext2D
  private bitmaps!: ImageBitmap[]

  private assets: Assets
  protected sounds!: Sounds
  private viewport: Camera
  private evts!: EventAdapter
  private playerCursors!: PlayerCursors
  private viewportSnapshots!: ViewportSnapshots
  protected playerSettings!: PlayerSettings
  protected puzzleStatus!: PuzzleStatus
  private puzzleTable!: PuzzleTable
  private fireworks!: fireworksController

  private tableWidth: number = 0
  private tableHeight: number = 0
  private tableBounds!: Rect
  private boardPos!: Point
  private boardDim!: Dim
  private pieceDim!: Dim
  private pieceDrawOffset!: number

  private isInterfaceVisible: boolean = true
  private isPreviewVisible: boolean = false
  private isViewFixedPieces: boolean = true
  private isViewLoosePieces: boolean = true

  private finished: boolean = false
  private longFinished: boolean = false

  private gameLoop!: GameLoopInstance

  constructor(
    protected readonly gameId: string,
    protected readonly clientId: string,
    private readonly wsAddress: string,
    protected readonly canvas: HTMLCanvasElement,
    protected readonly hud: HudType,
  ) {
    if (typeof window.DEBUG === 'undefined') window.DEBUG = false

    this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D
    this.assets = new Assets()
    this.viewport = new Camera()
  }

  shouldDrawPiece (piece: Piece): boolean {
    if (piece.owner === -1) {
      return this.isViewFixedPieces
    }
    return this.isViewLoosePieces
  }

  getWsAddres(): string {
    return this.wsAddress
  }

  getMode(): string {
    return MODE_PLAY
  }

  time(): number {
    return Time.timestamp()
  }

  getWindow(): Window {
    return window
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas
  }

  getViewport(): Camera {
    return this.viewport
  }

  abstract init(): Promise<void>

  abstract connect(): Promise<void>

  abstract unload(): void

  unregisterEvents(): void {
    this.evts.unregisterEvents()
  }

  stopGameLoop(): void {
    this.gameLoop.stop()
  }

  async initBaseProps(): Promise<void> {
    this.initFireworks()

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

    this.canvas.classList.add('loaded')
    this.hud.setPuzzleCut()

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
  }

  initFireworks(): void {
    this.fireworks = new fireworksController(this.canvas, GameCommon.getRng(this.gameId))
    this.fireworks.init()
  }

  initFinishState(): void {
    this.longFinished = !! GameCommon.getFinishTs(this.gameId)
    this.finished = this.longFinished
  }

  initGameLoop(): void {
    this.gameLoop = run({
      update: this.onUpdate.bind(this),
      render: this.onRender.bind(this),
    })
  }

  previewImageUrl(): string {
    return GameCommon.getImageUrl(this.gameId)
  }

  checkFinished(): void {
    this.finished = !! GameCommon.getFinishTs(this.gameId)
    if (this.justFinished()) {
      this.fireworks.update()
      this.requireRerender()
    }
  }

  shouldDrawPlayer(player: Player): boolean {
    return player.id !== this.clientId
  }

  centerPuzzle(): void {
    // center on the puzzle
    this.viewport.reset()
    this.viewport.move(
      -(this.tableWidth - this.canvas.width) /2,
      -(this.tableHeight - this.canvas.height) /2
    )

    // zoom viewport to fit whole puzzle in
    const x = this.viewport.worldDimToViewportRaw(this.boardDim)
    const border = 20
    const targetW = this.canvas.width - (border * 2)
    const targetH = this.canvas.height - (border * 2)
    if (
      (x.w > targetW || x.h > targetH)
      || (x.w < targetW && x.h < targetH)
    ) {
      const zoom = Math.min(targetW / x.w, targetH / x.h)
      const center = { x: this.canvas.width / 2, y: this.canvas.height / 2 }
      this.viewport.setZoom(zoom, center)
    }
  }

  justFinished(): boolean {
    return this.finished && !this.longFinished
  }

  emitToggleInterface(): void {
    this.isInterfaceVisible = !this.isInterfaceVisible
    this.hud.toggleInterface(this.isInterfaceVisible)
    this.showStatusMessage('Interface', this.isInterfaceVisible)
  }

  emitTogglePreview(): void {
    this.isPreviewVisible = !this.isPreviewVisible
    this.hud.togglePreview(this.isPreviewVisible)
  }

  toggleViewFixedPieces(): void {
    this.isViewFixedPieces = !this.isViewFixedPieces
    this.showStatusMessage(`${this.isViewFixedPieces ? 'Showing' : 'Hiding'} finished pieces`)
    this.requireRerender()
  }

  toggleViewLoosePieces(): void {
    this.isViewLoosePieces = !this.isViewLoosePieces
    this.showStatusMessage(`${this.isViewLoosePieces ? 'Showing' : 'Hiding'} unfinished pieces`)
    this.requireRerender()
  }

  togglePreview(value: boolean): void {
    if (this.isPreviewVisible !== value) {
      this.isPreviewVisible = value
    }
  }

  toggleHotkeys(value: boolean): void {
    this.evts.setHotkeys(value)
  }

  changeStatus(value: any): void {
    this.hud.setStatus(value)
  }

  changePlayers(value: any): void {
    this.hud.setPlayers(value)
  }

  getScoreMode(): ScoreMode {
    return GameCommon.getScoreMode(this.gameId)
  }

  getSnapMode(): SnapMode {
    return GameCommon.getSnapMode(this.gameId)
  }

  getShapeMode(): ShapeMode {
    return GameCommon.getShapeMode(this.gameId)
  }

  getImageTitle(): string {
    return GameCommon.getPuzzle(this.gameId).info.image?.title || '<No Title>'
  }

  getImageUploaderName(): string {
    return GameCommon.getPuzzle(this.gameId).info.image?.uploaderName || '<Unknown>'
  }

  onServerEvent(msg: ServerEvent): void {
    const _msgType = msg[0]
    const _evClientId = msg[1]
    const _evClientSeq = msg[2]
    const evChanges = msg[3]

    let rerender: boolean = false;
    let otherPlayerPiecesConnected: boolean = false;

    for (const [changeType, changeData] of evChanges) {
      switch (changeType) {
        case Protocol.CHANGE_PLAYER: {
          const p = Util.decodePlayer(changeData)
          if (p.id !== this.clientId) {
            GameCommon.setPlayer(this.gameId, p.id, p)
            rerender = true
          }
        } break;
        case Protocol.CHANGE_PIECE: {
          const piece = Util.decodePiece(changeData)
          GameCommon.setPiece(this.gameId, piece.idx, piece)
          rerender = true
        } break;
        case Protocol.CHANGE_DATA: {
          GameCommon.setPuzzleData(this.gameId, changeData)
          rerender = true
        } break;
        case Protocol.PLAYER_SNAP: {
          const snapPlayerId = changeData
          if (snapPlayerId !== this.clientId) {
            otherPlayerPiecesConnected = true
          }
        } break;
      }
    }
    if (
      otherPlayerPiecesConnected
      && this.playerSettings.soundsEnabled()
      && this.playerSettings.otherPlayerClickSoundEnabled()
    ) {
      this.sounds.playOtherPieceConnected()
    }
    if (rerender) {
      this.requireRerender()
    }
    this.finished = !! GameCommon.getFinishTs(this.gameId)
  }

  onUpdate(): void {
    // handle key downs once per onUpdate
    // this will create Protocol.INPUT_EV_MOVE events if something
    // relevant is pressed
    this.evts.createKeyEvents()

    for (const evt of this.evts.consumeAll()) {
      this.handleEvent(evt)
    }

    this.checkFinished()
  }

  abstract handleEvent(evt: GameEvent): void

  handleLocalEvent(evt: GameEvent): boolean {
    const type = evt[0]
    if (type === Protocol.INPUT_EV_MOVE) {
      const dim = this.viewport.worldDimToViewportRaw({ w: evt[1], h: evt[2] })
      this.requireRerender()
      this.viewport.move(dim.w, dim.h)
      this.viewportSnapshots.remove(ViewportSnapshots.LAST)
    } else if (type === Protocol.INPUT_EV_MOUSE_MOVE) {
      const down = evt[5]
      if (down && !GameCommon.getFirstOwnedPiece(this.gameId, this.clientId)) {
        // move the cam
        const diff = this.viewport.worldDimToViewportRaw({ w: evt[3], h: evt[4] })
        this.requireRerender()
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
      this.requireRerender()
      this.viewport.zoom('in', this.viewport.worldToViewportRaw(pos))
      this.viewportSnapshots.remove(ViewportSnapshots.LAST)
    } else if (type === Protocol.INPUT_EV_ZOOM_OUT) {
      const pos = { x: evt[1], y: evt[2] }
      this.requireRerender()
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
    } else if (type === Protocol.INPUT_EV_TOGGLE_FIXED_PIECES) {
      this.toggleViewFixedPieces()
    } else if (type === Protocol.INPUT_EV_TOGGLE_LOOSE_PIECES) {
      this.toggleViewLoosePieces()
    } else if (type === Protocol.INPUT_EV_TOGGLE_TABLE) {
      this.playerSettings.toggleShowTable()
    } else if (type === Protocol.INPUT_EV_CENTER_FIT_PUZZLE) {
      const slot = 'center'
      const handled = this.viewportSnapshots.handle(slot)
      this.showStatusMessage(handled ? `Restored position "${handled}"` : `Position "${slot}" not set`)
    } else if (type === Protocol.INPUT_EV_STORE_POS) {
      const slot: string = `${evt[1]}`
      this.viewportSnapshots.snap(slot)
      this.showStatusMessage(`Stored position ${slot}`)
    } else if (type === Protocol.INPUT_EV_RESTORE_POS) {
      const slot: string = `${evt[1]}`
      const handled = this.viewportSnapshots.handle(slot)
      this.showStatusMessage(handled ? `Restored position "${handled}"` : `Position "${slot}" not set`)
    } else {
      return false
    }
    return true
  }

  async onRender (): Promise<void> {
    if (!this.rerender) {
      return
    }

    const ts = this.time()

    let pos: Point
    let dim: Dim
    let bmp: ImageBitmap

    if (window.DEBUG) Debug.checkpoint_start(0)

    // CLEAR CTX
    // ---------------------------------------------------------------
    this.ctx.fillStyle = this.playerSettings.background()
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    if (window.DEBUG) Debug.checkpoint('clear done')
    // ---------------------------------------------------------------


    // DRAW TABLE
    // ---------------------------------------------------------------
    if (this.playerSettings.showTable()) {
      const tableImg = this.puzzleTable.getImage(this.playerSettings.tableTexture())
      if (tableImg) {
        pos = this.viewport.worldToViewportRaw(this.tableBounds)
        dim = this.viewport.worldDimToViewportRaw(this.tableBounds)
        this.ctx.drawImage(tableImg, pos.x, pos.y, dim.w, dim.h)
      }
    }
    if (window.DEBUG) Debug.checkpoint('table done')
    // ---------------------------------------------------------------


    // DRAW BOARD
    // ---------------------------------------------------------------
    if (!this.playerSettings.showTable()) {
      pos = this.viewport.worldToViewportRaw(this.boardPos)
      dim = this.viewport.worldDimToViewportRaw(this.boardDim)
      this.ctx.fillStyle = 'rgba(255, 255, 255, .3)'
      this.ctx.fillRect(pos.x, pos.y, dim.w, dim.h)
    }
    if (window.DEBUG) Debug.checkpoint('board done')
    // ---------------------------------------------------------------


    // DRAW PIECES
    // ---------------------------------------------------------------
    const pieces = GameCommon.getPiecesSortedByZIndex(this.gameId)
    if (window.DEBUG) Debug.checkpoint('get pieces done')

    dim = this.viewport.worldDimToViewportRaw(this.pieceDim)
    for (const piece of pieces) {
      if (!this.shouldDrawPiece(piece)) {
        continue
      }
      bmp = this.bitmaps[piece.idx]
      pos = this.viewport.worldToViewportRaw({
        x: this.pieceDrawOffset + piece.pos.x,
        y: this.pieceDrawOffset + piece.pos.y,
      })
      this.ctx.drawImage(bmp,
        0, 0, bmp.width, bmp.height,
        pos.x, pos.y, dim.w, dim.h
      )
    }
    if (window.DEBUG) Debug.checkpoint('pieces done')
    // ---------------------------------------------------------------


    // DRAW PLAYERS
    // ---------------------------------------------------------------
    const texts: Array<FixedLengthArray<[string, number, number]>> = []
    // Cursors
    for (const p of GameCommon.getActivePlayers(this.gameId, ts)) {
      if (this.shouldDrawPlayer(p)) {
        bmp = await this.playerCursors.get(p)
        pos = this.viewport.worldToViewport(p)
        this.ctx.drawImage(bmp, pos.x - this.playerCursors.CURSOR_W_2, pos.y - this.playerCursors.CURSOR_H_2)
        if (this.playerSettings.showPlayerNames()) {
          // performance:
          // not drawing text directly here, to have less ctx
          // switches between drawImage and fillTxt
          texts.push([`${p.name} (${p.points})`, pos.x, pos.y + this.playerCursors.CURSOR_H])
        }
      }
    }

    // Names
    this.ctx.fillStyle = 'white'
    this.ctx.textAlign = 'center'
    for (const [txt, x, y] of texts) {
      this.ctx.fillText(txt, x, y)
    }

    if (window.DEBUG) Debug.checkpoint('players done')

    // propagate HUD changes
    // ---------------------------------------------------------------
    this.puzzleStatus.update(ts)
    if (window.DEBUG) Debug.checkpoint('HUD done')
    // ---------------------------------------------------------------

    if (this.justFinished()) {
      this.fireworks.render()
    }

    this.rerender = false
  }

  hasReplay(): boolean {
    return GameCommon.get(this.gameId)?.hasReplay ? true : false
  }

  getPlayerSettings(): PlayerSettings {
    return this.playerSettings
  }

  getPreviewImageUrl(): string {
    return GameCommon.getImageUrl(this.gameId)
  }

  getGameId(): string {
    return this.gameId
  }

  getClientId(): string {
    return this.clientId
  }

  requireRerender(): void {
    this.rerender = true
  }

  showStatusMessage(what: string, value: any = undefined): void {
    this.hud.addStatusMessage(what, value)
  }

  bgChange(value: string): void {
    this.evts.addEvent([Protocol.INPUT_EV_BG_COLOR, value])
  }

  changeTableTexture(_value: string): void {
    this.requireRerender()
  }

  changeShowTable(_value: boolean): void {
    this.requireRerender()
  }

  changeColor(value: string): void {
    this.evts.addEvent([Protocol.INPUT_EV_PLAYER_COLOR, value])
  }

  changeName(value: string): void {
    this.evts.addEvent([Protocol.INPUT_EV_PLAYER_NAME, value])
  }

  changeSoundsVolume(_value: number): void {
    this.sounds.playPieceConnected()
  }
}
