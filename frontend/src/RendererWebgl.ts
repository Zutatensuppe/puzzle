import Debug from '../../common/src/Debug'
import GameCommon from '../../common/src/GameCommon'
import type { Dim, Point, Rect } from '../../common/src/Geometry'
import type { EncodedPiece, EncodedPieceShape, EncodedPlayer, FireworksInterface, GameId, PlayerSettingsData, PuzzleStatusInterface, Timestamp } from '../../common/src/Types'
import { Camera } from '../../common/src/Camera'
import { logger } from '../../common/src/Util'
import type { PlayerCursors } from './PlayerCursors'
import type { PuzzleTable } from './PuzzleTable'
import type { Graphics } from './Graphics'
import { BgShaderWrapper } from './webgl/BgShaderWrapper'
import { getTextureInfoByPlayerSettings } from './PuzzleTableTextureInfo'
import { PiecesShaderWrapper } from './webgl/PiecesShaderWrapper'
import { PlayersShaderWrapper } from './webgl/PlayersShaderWrapper'
import type { Assets } from './Assets'
import { FireworksShaderWrapper } from './webgl/FireworksShaderWrapper'
import PuzzleGraphics from './PuzzleGraphics'

const log = logger('Renderer.ts')

const puzzleBitmapCache: Record<string, HTMLCanvasElement> = {}
let stencils: Record<EncodedPieceShape, ImageBitmap> | null = null

export class RendererWebgl {
  public debug: boolean = false
  public boundingBoxes: boolean = false

  private tableBounds!: Rect
  private boardPos!: Point
  private boardDim!: Dim
  private gl!: WebGL2RenderingContext

  private piecesShaderWrapper!: PiecesShaderWrapper
  private bgShaderWrapper!: BgShaderWrapper
  private playersShaderWrapper!: PlayersShaderWrapper
  private fireworksShaderWrapper!: FireworksShaderWrapper

  constructor(
    protected readonly gameId: GameId,
    protected readonly fireworks: FireworksInterface | null,
    protected readonly puzzleTable: PuzzleTable | null,
    protected readonly lockMovement: boolean,
    protected readonly canvas: HTMLCanvasElement,
    protected readonly graphics: Graphics,
    protected readonly assets: Assets,
  ) {
    this.boardDim = GameCommon.getBoardDim(this.gameId)
    this.boardPos = GameCommon.getBoardPos(this.gameId)
    this.tableBounds = GameCommon.getBounds(this.gameId)
  }

  async init() {
    this.gl = this.canvas.getContext('webgl2')!

    this.gl.enable(this.gl.DEPTH_TEST)
    this.gl.depthFunc(this.gl.LESS)

    console.time('load')
    if (!puzzleBitmapCache[this.gameId]) {
      puzzleBitmapCache[this.gameId] = await PuzzleGraphics.loadPuzzleBitmap(
        GameCommon.getPuzzle(this.gameId),
        GameCommon.getImageUrl(this.gameId),
        this.graphics,
      )
    }
    console.timeEnd('load')
    console.time('stencils')
    if (!stencils) {
      // all stencils, in flat puzzle we dont need all of them but still
      // create them here
      stencils = await PuzzleGraphics.createWebglStencilsFromPng(this.graphics, this.assets.Gfx.stencilsDefault)
    }
    console.timeEnd('stencils')

    this.bgShaderWrapper = new BgShaderWrapper(this.gl, this.graphics)
    this.bgShaderWrapper.init(this.tableBounds, this.boardDim, this.boardPos, puzzleBitmapCache[this.gameId])

    this.piecesShaderWrapper = new PiecesShaderWrapper(this.gl, this.gameId)
    this.piecesShaderWrapper.init(puzzleBitmapCache[this.gameId], stencils)

    this.playersShaderWrapper = new PlayersShaderWrapper(this.gl, this.assets, this.gameId, this.graphics)
    this.playersShaderWrapper.init()

    this.fireworksShaderWrapper = new FireworksShaderWrapper(this.gl, GameCommon.getRng(this.gameId))
    this.fireworksShaderWrapper.init()
  }

  async loadTableTexture(settings: PlayerSettingsData): Promise<void> {
    const textureInfo = getTextureInfoByPlayerSettings(settings)
    if (textureInfo) {
      await this.bgShaderWrapper?.loadTexture(textureInfo)
    }
  }

  public renderToImageString(
    boardDim: Dim,
    tableDim: Dim,
    ts: Timestamp,
    settings: PlayerSettingsData,
    shouldDrawEncodedPiece: (piece: EncodedPiece) => boolean,
    shouldDrawPlayer: (player: EncodedPlayer) => boolean,
    renderPreview: boolean,
  ) {
    const camera = new Camera()
    camera.calculateZoomCapping(boardDim, tableDim)
    camera.centerFit(boardDim, tableDim, boardDim, 0)
    const oldWidth = this.canvas.width
    const oldHeight = this.canvas.height
    this.canvas.width = boardDim.w
    this.canvas.height = boardDim.h

    // update the viewport and clear the screen
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height)

    // draw background
    const pos = camera.worldToViewportRaw(this.tableBounds)
    const dim = camera.worldDimToViewportRaw(this.tableBounds)
    this.bgShaderWrapper?.render(
      settings.showTable,
      settings.showPuzzleBackground,
      renderPreview,
      settings.background,
      dim,
      pos,
    )

    // draw pieces
    this.piecesShaderWrapper?.render(camera, shouldDrawEncodedPiece)

    // draw players
    this.playersShaderWrapper?.render(camera, shouldDrawPlayer, settings.showPlayerNames, ts)
    const str = this.canvas.toDataURL('image/jpeg', 75)
    this.canvas.width = oldWidth
    this.canvas.height = oldHeight
    return str
  }

  render(
    camera: Camera,
    ts: Timestamp,
    settings: PlayerSettingsData,
    playerCursors: PlayerCursors | null,
    puzzleStatus: PuzzleStatusInterface,
    shouldDrawEncodedPiece: (piece: EncodedPiece) => boolean,
    shouldDrawPlayer: (player: EncodedPlayer) => boolean,
    renderFireworks: boolean,
    renderPreview: boolean,
  ) {
    if (this.debug) Debug.checkpoint_start(0)

    // ---------------------------------------------------------------
    // ---------------------------------------------------------------
    // ---------------------------------------------------------------

    // update the viewport and clear the screen
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height)

    // draw background
    this.bgShaderWrapper?.render(
      settings.showTable,
      settings.showPuzzleBackground,
      renderPreview,
      settings.background,
      camera.worldDimToViewportRaw(this.tableBounds),
      camera.worldToViewportRaw(this.tableBounds),
    )

    // draw pieces
    this.piecesShaderWrapper?.render(camera, shouldDrawEncodedPiece)

    // draw players
    this.playersShaderWrapper?.render(camera, shouldDrawPlayer, settings.showPlayerNames, ts)

    if (renderFireworks) {
      this.fireworksShaderWrapper?.render()
    }

    // propagate HUD changes
    // ---------------------------------------------------------------
    puzzleStatus.update(ts)
    if (this.debug) Debug.checkpoint('HUD done')
    // ---------------------------------------------------------------
  }
}
