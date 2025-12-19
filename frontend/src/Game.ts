'use strict'

import { Camera } from '@common/Camera'
import { CHANGE_TYPE, GAME_EVENT_TYPE } from '@common/Protocol'
import { run } from './gameloop'
import type { GameLoopInstance } from './gameloop'
import fireworksController from '@common/Fireworks'
import GameCommon from '@common/GameCommon'
import Time from '@common/Time'
import { logger } from '@common/Util'
import {
  RendererType,
  EncodedPieceIdx,
  EncodedPlayerIdx,
} from '@common/Types'
import type {
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
  RotationMode,
  GameId,
  ClientId,
  EncodedPiece,
  EncodedPlayer,
} from '@common/Types'
import _api from './_api'
import { Assets } from './Assets'
import { EventAdapter } from './EventAdapter'
import type { GraphicsInterface } from './Graphics'
import { Graphics } from './Graphics'
import { MODE_PLAY } from './GameMode'
import { PlayerCursors } from './PlayerCursors'
import { PlayerSettings } from './PlayerSettings'
import { PuzzleStatus } from './PuzzleStatus'
import { PuzzleTable } from './PuzzleTable'
import { Renderer } from './Renderer'
import { RendererWebgl } from './RendererWebgl'
import { Sounds } from './Sounds'
import { ViewportSnapshots } from './ViewportSnapshots'
import debug from './debug'

declare global {
  interface Window {
    DEBUG?: boolean
  }
}

const log = logger('Game.ts')

export interface GameInterface {
  readonly assets: Assets
  readonly graphics: GraphicsInterface
  reinit(clientId: ClientId): Promise<void>
  shouldDrawEncodedPiece(piece: EncodedPiece): boolean
  getWsAddres(): string
  getMode(): string
  time(): number
  getWindow(): Window
  getCanvas(): HTMLCanvasElement
  getViewport(): Camera
  init(): Promise<void>
  unload(): void
  registerEvents(): void
  unregisterEvents(): void
  stopGameLoop(): void
  initBaseProps(): Promise<void>
  initViewport(): void
  initFinishState(): void
  initGameLoop(): void
  previewImageUrl(): string
  checkFinished(): void
  loadTableTexture(settings: PlayerSettingsData): Promise<void>
  shouldDrawPlayer(player: EncodedPlayer): boolean
  justFinished(): boolean
  emitToggleInterface(): void
  emitTogglePreview(): void
  toggleViewFixedPieces(): void
  toggleViewLoosePieces(): void
  togglePreview(value: boolean): void
  toggleHotkeys(value: boolean): void
  changeStatus(value: GameStatus): void
  changePlayers(value: GamePlayers, registeredMap: RegisteredMap): void
  getScoreMode(): ScoreMode
  getSnapMode(): SnapMode
  getShapeMode(): ShapeMode
  getRotationMode(): RotationMode
  getImage(): ImageInfo
  onServerUpdateEvent(msg: ServerUpdateEvent): void
  onUpdate(): void
  handleEvent(evt: GameEvent): void
  handleLocalEvent(evt: GameEvent): boolean
  onRender(): void
  hasReplay(): boolean
  getPlayerSettings(): PlayerSettings
  getPreviewImageUrl(): string
  getGameId(): GameId
  getClientId(): ClientId
  requireRerender(): void
  showStatusMessage(what: string, value: number | string | boolean | undefined): void
  bgChange(value: string): void
  changeTableTexture(_value: string): void
  changeUseCustomTableTexture(_value: boolean): void
  changeCustomTableTexture(_value: string): void
  changeCustomTableTextureScale(_value: number): void
  changeShowTable(_value: boolean): void
  changeShowPuzzleBackground(_value: boolean): void
  changeColor(value: string): void
  changeName(value: string): void
  changeSoundsVolume(_value: number): void
  banPlayer(clientId: string): void
  unbanPlayer(clientId: string): void
}

export abstract class Game<HudType extends Hud> implements GameInterface {
  protected rerender: boolean = true

  public readonly assets: Assets
  public readonly graphics: Graphics
  protected sounds!: Sounds
  private viewport: Camera
  private evts!: EventAdapter
  private playerCursors!: PlayerCursors
  private viewportSnapshots!: ViewportSnapshots
  protected playerSettings!: PlayerSettings
  protected puzzleStatus!: PuzzleStatus
  private fireworks: FireworksInterface | null = null
  protected ctx!: CanvasRenderingContext2D
  protected rendererCanvas2d: Renderer | null = null
  protected rendererWebgl: RendererWebgl | null = null

  private isInterfaceVisible: boolean = true
  private isPreviewVisible: boolean = false
  private isViewFixedPieces: boolean = true
  private isViewLoosePieces: boolean = true

  private finished: boolean = false
  private longFinished: boolean = false

  private gameLoop: GameLoopInstance | null = null

  private onUpdateBound: () => void
  private onRenderBound: () => void

  constructor(
    protected readonly gameId: GameId,
    protected clientId: ClientId,
    private readonly wsAddress: string,
    protected readonly canvas: HTMLCanvasElement,
    protected readonly hud: HudType,
  ) {
    this.assets = new Assets()
    this.graphics = Graphics.getInstance()
    this.viewport = new Camera()

    this.onUpdateBound = this.onUpdate.bind(this)
    this.onRenderBound = this.onRender.bind(this)
  }

  async reinit(clientId: ClientId): Promise<void> {
    this.clientId = clientId
    await this.init()
  }

  shouldDrawEncodedPiece(piece: EncodedPiece): boolean {
    if (piece[EncodedPieceIdx.OWNER] === -1) {
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

  abstract unload(): void

  registerEvents(): void {
    this.evts.unregisterEvents()
    this.evts.registerEvents()
    if (this.fireworks) {
      window.removeEventListener('resize', this.fireworks.resizeBound)
      window.addEventListener('resize', this.fireworks.resizeBound)
    }
  }

  unregisterEvents(): void {
    if (this.fireworks) {
      window.removeEventListener('resize', this.fireworks.resizeBound)
    }
    this.evts.unregisterEvents()
  }

  stopGameLoop(): void {
    this.gameLoop?.stop()
    this.gameLoop = null
  }

  async initBaseProps(): Promise<void> {
    await this.assets.init(this.graphics)

    if (!this.playerCursors) {
      this.playerCursors = new PlayerCursors(this.canvas, this.assets, this.graphics)
    }

    if (!this.playerSettings) {
      this.playerSettings = new PlayerSettings(this)
      this.playerSettings.init()
    }

    if (!this.evts) {
      this.evts = new EventAdapter(this, this.playerSettings)
    }
    if (!this.viewportSnapshots) {
      this.viewportSnapshots = new ViewportSnapshots(this.evts, this.viewport)
    }

    if (!this.sounds) {
      this.sounds = new Sounds(this.assets, this.playerSettings)
    }

    await this.initRenderer()

    this.canvas.classList.add('loaded')
    this.hud.setPuzzleCut()

    this.registerEvents()

    this.initViewport()

    if (!this.puzzleStatus) {
      this.puzzleStatus = new PuzzleStatus(this)
    }
    this.puzzleStatus.update(this.time())

    this.initFinishState()

    this.evts.addEvent([GAME_EVENT_TYPE.INPUT_EV_BG_COLOR, this.playerSettings.background()])
    this.evts.addEvent([GAME_EVENT_TYPE.INPUT_EV_PLAYER_COLOR, this.playerSettings.color()])
    this.evts.addEvent([GAME_EVENT_TYPE.INPUT_EV_PLAYER_NAME, this.playerSettings.name()])

    this.playerCursors.updatePlayerCursorColor(this.playerSettings.color())
  }

  private async initRenderer(): Promise<void> {
    if (this.rendererWebgl || this.rendererCanvas2d) {
      // nothing to do. renderer already set up
      return
    }

    if (this.playerSettings.renderer() === RendererType.WEBGL2 && this.graphics.hasWebGL2Support()) {
      this.rendererWebgl = new RendererWebgl(
        this.gameId,
        this.fireworks,
        new PuzzleTable(this.graphics),
        false,
        this.canvas,
        this.graphics,
        this.assets,
      )
      await this.rendererWebgl.init()
      await this.rendererWebgl.loadTableTexture(this.playerSettings.getSettings())
    } else {
      this.ctx = this.canvas.getContext('2d')!

      if (!this.fireworks) {
        this.fireworks = new fireworksController(this.canvas, GameCommon.getRng(this.gameId))
        this.fireworks.init()
      }

      this.rendererCanvas2d = new Renderer(
        this.gameId,
        this.fireworks,
        new PuzzleTable(this.graphics),
        false,
        this.graphics,
      )
      await this.rendererCanvas2d.init()
      await this.rendererCanvas2d.loadTableTexture(this.playerSettings.getSettings())
    }
  }

  public banPlayer(clientId: ClientId): void {
    this.evts.addEvent([GAME_EVENT_TYPE.INPUT_EV_BAN_PLAYER, clientId])
  }

  public unbanPlayer(clientId: ClientId): void {
    this.evts.addEvent([GAME_EVENT_TYPE.INPUT_EV_UNBAN_PLAYER, clientId])
  }

  initViewport(): void {
    this.canvas.width = this.canvas.clientWidth
    this.canvas.height = this.canvas.clientHeight

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

  initFinishState(): void {
    this.longFinished = !!GameCommon.getFinishTs(this.gameId)
    this.finished = this.longFinished
  }

  initGameLoop(): void {
    if (!this.gameLoop) {
      this.gameLoop = run({
        update: this.onUpdateBound,
        render: this.onRenderBound,
      })
    }
  }

  previewImageUrl(): string {
    return GameCommon.getImageUrl(this.gameId)
  }

  checkFinished(): void {
    this.finished = !!GameCommon.getFinishTs(this.gameId)
    if (this.justFinished()) {
      this.fireworks?.update()
      // need to constantly rerender for fireworks
      this.requireRerender()
    }
  }

  async loadTableTexture(settings: PlayerSettingsData): Promise<void> {
    if (settings.showTable) {
      if (this.rendererWebgl) {
        await this.rendererWebgl.loadTableTexture(settings)
      } else if (this.rendererCanvas2d){
        await this.rendererCanvas2d.loadTableTexture(settings)
      }
    }
    this.requireRerender()
  }

  shouldDrawPlayer(player: EncodedPlayer): boolean {
    return player[EncodedPlayerIdx.ID] !== this.clientId
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

  getRotationMode(): RotationMode {
    return GameCommon.getRotationMode(this.gameId)
  }

  getImage(): ImageInfo {
    return GameCommon.getImage(this.gameId)
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
          const p = changeData
          if (p[EncodedPlayerIdx.ID] !== this.clientId) {
            GameCommon.setPlayer(this.gameId, p[EncodedPlayerIdx.ID], p)
            rerender = true
          }
        } break
        case CHANGE_TYPE.PIECE: {
          GameCommon.setPiece(this.gameId, changeData[EncodedPieceIdx.IDX], changeData)
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
    this.finished = !!GameCommon.getFinishTs(this.gameId)
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
      void this.loadTableTexture(this.playerSettings.getSettings())
    } else if (type === GAME_EVENT_TYPE.INPUT_EV_TOGGLE_PUZZLE_BACKGROUND) {
      this.playerSettings.toggleShowPuzzleBackground()
      void this.loadTableTexture(this.playerSettings.getSettings())
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

  onRender(): void {
    if (!this.rerender) {
      return
    }

    if (this.rendererWebgl) {
      this.rendererWebgl.debug = debug.isDebugEnabled()
      this.rendererWebgl.render(
        this.viewport,
        this.time(),
        this.playerSettings.getSettings(),
        this.playerCursors,
        this.puzzleStatus,
        (piece: EncodedPiece) => this.shouldDrawEncodedPiece(piece),
        (player: EncodedPlayer) => this.shouldDrawPlayer(player),
        this.justFinished(),
        this.showImagePreviewInBackground(),
      )
    } else if (this.rendererCanvas2d) {
      this.rendererCanvas2d.debug = debug.isDebugEnabled()
      this.rendererCanvas2d.render(
        this.canvas,
        this.ctx,
        this.viewport,
        this.time(),
        this.playerSettings.getSettings(),
        this.playerCursors,
        this.puzzleStatus,
        (piece: EncodedPiece) => this.shouldDrawEncodedPiece(piece),
        (player: EncodedPlayer) => this.shouldDrawPlayer(player),
        this.justFinished(),
        this.showImagePreviewInBackground(),
      )
    }

    this.rerender = false
  }

  showImagePreviewInBackground(): boolean {
    return GameCommon.getShowImagePreviewInBackground(this.gameId)
  }

  hasReplay(): boolean {
    return GameCommon.hasReplay(this.gameId)
  }

  getPlayerSettings(): PlayerSettings {
    return this.playerSettings
  }

  getPreviewImageUrl(): string {
    return GameCommon.getImageUrl(this.gameId)
  }

  getGameId(): GameId {
    return this.gameId
  }

  getClientId(): ClientId {
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

  changeShowPuzzleBackground(_value: boolean): void {
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
