import Debug from '../../common/src/Debug'
import GameCommon from '../../common/src/GameCommon'
import { Dim, Point, Rect } from '../../common/src/Geometry'
import { EncodedPieceShape, FireworksInterface, GameId, Piece, Player, PlayerSettingsData, PuzzleStatusInterface, Timestamp } from '../../common/src/Types'
import { Camera } from '../../common/src/Camera'
import { logger } from '../../common/src/Util'
import { PlayerCursors } from './PlayerCursors'
import { PuzzleTable } from './PuzzleTable'
import { Graphics } from './Graphics'
import { Viewport } from './webgl/Viewport'
import { BgShaderWrapper } from './webgl/BgShaderWrapper'
import { getTextureInfoByPlayerSettings } from './PuzzleTableTextureInfo'
import { PiecesShaderWrapper } from './webgl/PiecesShaderWrapper'
import { PlayersShaderWrapper } from './webgl/PlayersShaderWrapper'
import { Assets } from './Assets'
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
  private pieceDim!: Dim
  private pieceDrawOffset!: number
  private gl!: WebGL2RenderingContext
  private viewport!: Viewport

  // we can cache the whole background when we are in lockMovement mode
  private backgroundCache: ImageData | null = null

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
    this.pieceDrawOffset = GameCommon.getPieceDrawOffset(this.gameId)
    this.boardDim = GameCommon.getBoardDim(this.gameId)
    this.boardPos = GameCommon.getBoardPos(this.gameId)
    this.pieceDim = GameCommon.getPieceDim(this.gameId)
    this.tableBounds = GameCommon.getBounds(this.gameId)
  }

  async init() {
    this.gl = this.canvas.getContext('webgl2')!
    this.viewport = new Viewport(this.canvas)

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
      stencils = await PuzzleGraphics.createWebglStencils(this.graphics)
    }
    console.timeEnd('stencils')

    this.bgShaderWrapper = new BgShaderWrapper(this.gl, this.graphics)
    this.bgShaderWrapper.init(this.tableBounds, this.boardDim, this.boardPos, puzzleBitmapCache[this.gameId])

    this.piecesShaderWrapper = new PiecesShaderWrapper(this.gl, this.viewport, this.gameId)
    this.piecesShaderWrapper.init(puzzleBitmapCache[this.gameId], stencils)

    this.playersShaderWrapper = new PlayersShaderWrapper(this.gl, this.assets, this.gameId)
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

  renderToImageString(
    canvasDim: Dim,
    camera: Camera,
    ts: Timestamp,
    settings: PlayerSettingsData,
    shouldDrawPiece: (piece: Piece) => boolean,
    shouldDrawPlayer: (player: Player) => boolean,
    renderPreview: boolean,
  ) {
    const oldWidth = this.canvas.width
    const oldHeight = this.canvas.height
    this.canvas.width = canvasDim.w
    this.canvas.height = canvasDim.h
    this.viewport.resize(this.canvas)

    // update the viewport and clear the screen
    this.gl.viewport(0, 0, this.viewport.width, this.viewport.height)

    // draw background
    const pos = camera.worldToViewportRaw(this.tableBounds)
    const dim = camera.worldDimToViewportRaw(this.tableBounds)
    this.bgShaderWrapper?.render(settings.showTable, renderPreview, settings.background, dim, pos)

    // draw pieces
    this.piecesShaderWrapper?.render(camera, shouldDrawPiece)

    // draw players
    this.playersShaderWrapper?.render(camera, shouldDrawPlayer, settings.showPlayerNames, ts)
    const str = this.canvas.toDataURL('image/jpeg', 75)
    this.canvas.width = oldWidth
    this.canvas.height = oldHeight
    this.viewport.resize(this.canvas)
    return str
  }

  render(
    camera: Camera,
    ts: Timestamp,
    settings: PlayerSettingsData,
    playerCursors: PlayerCursors | null,
    puzzleStatus: PuzzleStatusInterface,
    shouldDrawPiece: (piece: Piece) => boolean,
    shouldDrawPlayer: (player: Player) => boolean,
    renderFireworks: boolean,
    renderPreview: boolean,
  ) {
    if (!this.viewport) {
      return
    }

    if (this.debug) Debug.checkpoint_start(0)

    // ---------------------------------------------------------------
    // ---------------------------------------------------------------
    // ---------------------------------------------------------------

    this.viewport.resize(this.canvas)

    // update the viewport and clear the screen
    this.gl.viewport(0, 0, this.viewport.width, this.viewport.height)

    // draw background
    this.bgShaderWrapper?.render(
      settings.showTable,
      renderPreview,
      settings.background,
      camera.worldDimToViewportRaw(this.tableBounds),
      camera.worldToViewportRaw(this.tableBounds),
    )

    // draw pieces
    this.piecesShaderWrapper?.render(camera, shouldDrawPiece)

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
