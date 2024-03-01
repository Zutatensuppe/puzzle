'use strict'

import { GameLoopInstance, run } from './gameloop'
import { Camera } from '../../common/src/Camera'
import Util, { logger } from '../../common/src/Util'
import GameCommon from '../../common/src/GameCommon'
import fireworksController from '../../common/src/Fireworks'
import { CHANGE_TYPE, GAME_EVENT_TYPE } from '../../common/src/Protocol'
import Time from '../../common/src/Time'
import {
  Player,
  Piece,
  Hud,
  ScoreMode,
  SnapMode,
  ShapeMode,
  GameEvent,
  ImageInfo,
  FireworksInterface,
  PlayerSettingsData,
  ServerUpdateEvent,
  GamePlayers,
  GameStatus,
  RegisteredMap,
  AssetsInterface,
  GraphicsInterface,
} from '../../common/src/Types'
import { Assets } from './Assets'
import { EventAdapter } from './EventAdapter'
import { PuzzleTable } from '../../common/src/PuzzleTable'
import { ViewportSnapshots } from './ViewportSnapshots'
import { PlayerSettings } from './PlayerSettings'
import { Sounds } from './Sounds'
import { PuzzleStatus } from './PuzzleStatus'
import { PlayerCursors } from '../../common/src/PlayerCursors'
import _api from './_api'
import { MODE_PLAY } from './GameMode'
import { Graphics } from './Graphics'
import { Renderer } from '../../common/src/Renderer'

declare global {
  interface Window {
      DEBUG?: boolean
  }
}

const log = logger('Game.ts')

export abstract class Game<HudType extends Hud> {
  protected rerender: boolean = true

  private assets: Assets
  private graphics: GraphicsInterface
  protected sounds!: Sounds
  private viewport: Camera
  private evts!: EventAdapter
  private playerCursors!: PlayerCursors
  private viewportSnapshots!: ViewportSnapshots
  protected playerSettings!: PlayerSettings
  protected puzzleStatus!: PuzzleStatus
  private fireworks!: FireworksInterface
  private renderer!: Renderer

  private isInterfaceVisible: boolean = true
  private isPreviewVisible: boolean = false
  private isViewFixedPieces: boolean = true
  private isViewLoosePieces: boolean = true

  private finished: boolean = false
  private longFinished: boolean = false

  private gameLoop!: GameLoopInstance

  constructor(
    protected readonly gameId: string,
    protected clientId: string,
    private readonly wsAddress: string,
    protected readonly canvas: HTMLCanvasElement,
    protected readonly hud: HudType,
  ) {
    if (typeof window.DEBUG === 'undefined') window.DEBUG = false

    this.assets = new Assets()
    this.graphics = new Graphics()
    this.viewport = new Camera()
  }

  async reinit(clientId: string): Promise<void> {
    this.clientId = clientId
    this.unload()
    await this.init()
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

  registerEvents(): void {
    this.evts.registerEvents()
    window.addEventListener('resize', this.fireworks.resizeBound)
  }

  unregisterEvents(): void {
    window.removeEventListener('resize', this.fireworks.resizeBound)
    this.evts.unregisterEvents()
  }

  stopGameLoop(): void {
    this.gameLoop.stop()
  }

  async initBaseProps(): Promise<void> {
    this.initFireworks()

    await this.assets.init(this.graphics)
    this.playerCursors = new PlayerCursors(this.canvas, this.assets, this.graphics)

    this.evts = new EventAdapter(this)
    this.viewportSnapshots = new ViewportSnapshots(this.evts, this.viewport)
    this.playerSettings = new PlayerSettings(this)
    this.playerSettings.init()
    this.sounds = new Sounds(this.assets, this.playerSettings)

    const puzzleTable = new PuzzleTable(this.graphics)
    await puzzleTable.loadTexture(this.gameId, this.playerSettings.getSettings())
    this.renderer = new Renderer(this.gameId, this.canvas, this.viewport, this.fireworks, puzzleTable, false)
    await this.renderer.init(this.graphics)

    this.canvas.classList.add('loaded')
    this.hud.setPuzzleCut()

    this.registerEvents()

    this.initViewport()

    this.puzzleStatus = new PuzzleStatus(this)
    this.puzzleStatus.update(this.time())

    this.initFinishState()

    this.evts.addEvent([GAME_EVENT_TYPE.INPUT_EV_BG_COLOR, this.playerSettings.background()])
    this.evts.addEvent([GAME_EVENT_TYPE.INPUT_EV_PLAYER_COLOR, this.playerSettings.color()])
    this.evts.addEvent([GAME_EVENT_TYPE.INPUT_EV_PLAYER_NAME, this.playerSettings.name()])

    this.playerCursors.updatePlayerCursorColor(this.playerSettings.color())
  }

  initViewport(): void {
    // initialize some view data
    // this global data will change according to input events

    // theoretically we need to recalculate this when window resizes
    // but it probably doesnt matter so much
    const tableDim = GameCommon.getTableDim(this.gameId)
    const boardDim = GameCommon.getBoardDim(this.gameId)

    const windowDim = { w: window.innerWidth, h: window.innerHeight }
    this.viewport.calculateZoomCapping(windowDim, tableDim)
    const canvasDim = { w: this.canvas.width, h: this.canvas.height }
    this.viewport.centerFit(canvasDim, tableDim, boardDim, 20)
    this.viewportSnapshots.snap('center')
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

  async loadTableTexture(settings: PlayerSettingsData): Promise<void> {
    await this.renderer.loadTableTexture(settings)
    this.requireRerender()
  }

  shouldDrawPlayer(player: Player): boolean {
    return player.id !== this.clientId
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

  changeStatus(value: GameStatus): void {
    this.hud.setStatus(value)
  }

  changePlayers(value: GamePlayers, registeredMap: RegisteredMap): void {
    this.hud.setPlayers(value, registeredMap)
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

  getImage(): ImageInfo {
    return GameCommon.getPuzzle(this.gameId).info.image
  }

  getAssets(): AssetsInterface {
    return this.assets
  }

  getGraphics(): GraphicsInterface {
    return this.graphics
  }

  onServerUpdateEvent(msg: ServerUpdateEvent): void {
    const _msgType = msg[0]
    const _evClientId = msg[1]
    const _evClientSeq = msg[2]
    const evChanges = msg[3]

    let rerender: boolean = false
    let otherPlayerPiecesConnected: boolean = false

    for (const [changeType, changeData] of evChanges) {
      switch (changeType) {
        case CHANGE_TYPE.PLAYER: {
          const p = Util.decodePlayer(changeData)
          if (p.id !== this.clientId) {
            GameCommon.setPlayer(this.gameId, p.id, p)
            rerender = true
          }
        } break
        case CHANGE_TYPE.PIECE: {
          const piece = Util.decodePiece(changeData)
          GameCommon.setPiece(this.gameId, piece.idx, piece)
          rerender = true
        } break
        case CHANGE_TYPE.DATA: {
          GameCommon.setPuzzleData(this.gameId, changeData)
          rerender = true
        } break
        case CHANGE_TYPE.PLAYER_SNAP: {
          const snapPlayerId = changeData
          if (snapPlayerId !== this.clientId) {
            otherPlayerPiecesConnected = true
          }
        } break
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
    // this will create GAME_EVENT_TYPE.INPUT_EV_MOVE events if something
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
    if (type === GAME_EVENT_TYPE.INPUT_EV_MOVE) {
      const dim = this.viewport.worldDimToViewportRaw({ w: evt[1], h: evt[2] })
      this.requireRerender()
      this.viewport.move(dim.w, dim.h)
      this.viewportSnapshots.remove(ViewportSnapshots.LAST)
    } else if (type === GAME_EVENT_TYPE.INPUT_EV_MOUSE_MOVE) {
      const down = evt[5]
      if (down && !GameCommon.getFirstOwnedPiece(this.gameId, this.clientId)) {
        // move the cam
        const diff = this.viewport.worldDimToViewportRaw({ w: evt[3], h: evt[4] })
        this.requireRerender()
        this.viewport.move(diff.w, diff.h)
        this.viewportSnapshots.remove(ViewportSnapshots.LAST)
      }
    } else if (type === GAME_EVENT_TYPE.INPUT_EV_PLAYER_COLOR) {
      this.playerCursors.updatePlayerCursorColor(evt[1])
    } else if (type === GAME_EVENT_TYPE.INPUT_EV_MOUSE_DOWN) {
      this.playerCursors.updatePlayerCursorState(true)
    } else if (type === GAME_EVENT_TYPE.INPUT_EV_MOUSE_UP) {
      this.playerCursors.updatePlayerCursorState(false)
    } else if (type === GAME_EVENT_TYPE.INPUT_EV_ZOOM_IN) {
      const pos = { x: evt[1], y: evt[2] }
      this.requireRerender()
      this.viewport.zoom('in', this.viewport.worldToViewportRaw(pos))
      this.viewportSnapshots.remove(ViewportSnapshots.LAST)
    } else if (type === GAME_EVENT_TYPE.INPUT_EV_ZOOM_OUT) {
      const pos = { x: evt[1], y: evt[2] }
      this.requireRerender()
      this.viewport.zoom('out', this.viewport.worldToViewportRaw(pos))
      this.viewportSnapshots.remove(ViewportSnapshots.LAST)
    } else if (type === GAME_EVENT_TYPE.INPUT_EV_TOGGLE_INTERFACE) {
      this.emitToggleInterface()
    } else if (type === GAME_EVENT_TYPE.INPUT_EV_TOGGLE_PREVIEW) {
      this.emitTogglePreview()
    } else if (type === GAME_EVENT_TYPE.INPUT_EV_TOGGLE_SOUNDS) {
      this.playerSettings.toggleSoundsEnabled()
    } else if (type === GAME_EVENT_TYPE.INPUT_EV_TOGGLE_PLAYER_NAMES) {
      this.playerSettings.togglePlayerNames()
    } else if (type === GAME_EVENT_TYPE.INPUT_EV_TOGGLE_FIXED_PIECES) {
      this.toggleViewFixedPieces()
    } else if (type === GAME_EVENT_TYPE.INPUT_EV_TOGGLE_LOOSE_PIECES) {
      this.toggleViewLoosePieces()
    } else if (type === GAME_EVENT_TYPE.INPUT_EV_TOGGLE_TABLE) {
      this.playerSettings.toggleShowTable()
    } else if (type === GAME_EVENT_TYPE.INPUT_EV_CENTER_FIT_PUZZLE) {
      const slot = 'center'
      const handled = this.viewportSnapshots.handle(slot)
      this.showStatusMessage(handled ? `Restored position "${handled}"` : `Position "${slot}" not set`)
    } else if (type === GAME_EVENT_TYPE.INPUT_EV_STORE_POS) {
      const slot: string = `${evt[1]}`
      this.viewportSnapshots.snap(slot)
      this.showStatusMessage(`Stored position ${slot}`)
    } else if (type === GAME_EVENT_TYPE.INPUT_EV_RESTORE_POS) {
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

    this.renderer.debug = window.DEBUG ? true : false
    this.renderer.render(
      this.time(),
      this.playerSettings.getSettings(),
      this.playerCursors,
      this.puzzleStatus,
      (piece: Piece) => this.shouldDrawPiece(piece),
      (player: Player) => this.shouldDrawPlayer(player),
      this.justFinished(),
    )

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
    this.evts.addEvent([GAME_EVENT_TYPE.INPUT_EV_BG_COLOR, value])
  }

  changeTableTexture(_value: string): void {
    this.requireRerender()
  }

  changeUseCustomTableTexture(_value: boolean): void {
    this.requireRerender()
  }

  changeCustomTableTexture(_value: string): void {
    this.requireRerender()
  }

  changeCustomTableTextureScale(_value: number): void {
    this.requireRerender()
  }

  changeShowTable(_value: boolean): void {
    this.requireRerender()
  }

  changeColor(value: string): void {
    this.evts.addEvent([GAME_EVENT_TYPE.INPUT_EV_PLAYER_COLOR, value])
  }

  changeName(value: string): void {
    this.evts.addEvent([GAME_EVENT_TYPE.INPUT_EV_PLAYER_NAME, value])
  }

  changeSoundsVolume(_value: number): void {
    this.sounds.playPieceConnected()
  }
}
