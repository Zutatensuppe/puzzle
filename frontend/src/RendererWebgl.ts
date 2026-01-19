import Debug from '@common/Debug'
import GameCommon from '@common/GameCommon'
import type { Dim, Point, Rect } from '@common/Geometry'
import type { EncodedPiece, EncodedPieceShape, EncodedPlayer, FireworksInterface, GameId, ImageFrameMeta, PlayerSettingsData, PuzzleStatusInterface, Timestamp } from '@common/Types'
import { Camera } from '@common/Camera'
import { logger } from '@common/Util'
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
import { GraphicsEnum } from '@common/Enums'
import { AnimatedImageLoader } from './AnimatedImageLoader'

const log = logger('RendererWebgl.ts')

const puzzleBitmapCache: Record<string, HTMLCanvasElement> = {}
let stencils: Record<EncodedPieceShape, ImageBitmap> | null = null

interface ImageAnimationState {
  frames: HTMLCanvasElement[]
  delays: number[]
  currentFrame: number
  lastFrameTime: number
}

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

  private imageAnimation: ImageAnimationState | null = null

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

    // Set up Image animation if this image carries pre-extracted frames.
    const animatedImageMeta = GameCommon.getImage(this.gameId).animationFrames
    if (animatedImageMeta && animatedImageMeta.length > 1) {
      await this.initImageAnimation(animatedImageMeta)
    }

    console.time('stencils')
    if (!stencils) {
      // all stencils, in flat puzzle we dont need all of them but still
      // create them here
      stencils = await PuzzleGraphics.createWebglStencilsFromPng(this.graphics, this.assets.Gfx[GraphicsEnum.PIECE_STENCILS_SPRITESHEET])
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

  private async initImageAnimation(metas: ImageFrameMeta[]): Promise<void> {
    try {
      const animatedImageLoader = AnimatedImageLoader.getInstance()
      const animatedFrames = await animatedImageLoader.loadFrames(metas)

      const frames: HTMLCanvasElement[] = []
      const delays: number[] = []

      for (const frame of animatedFrames) {
        frames.push(frame.canvas)
        delays.push(frame.delay)
      }

      this.imageAnimation = {
        frames,
        delays,
        currentFrame: 0,
        lastFrameTime: performance.now(),
      }

      log.log(`Image Animation initialized with ${frames.length} frames`)
    } catch (e) {
      log.error('Failed to load animated frames for WebGL:', e)
    }
  }

  private updateImageAnimation(): void {
    if (!this.imageAnimation) return

    const now = performance.now()
    const timeSinceLastFrame = now - this.imageAnimation.lastFrameTime
    const currentDelay = this.imageAnimation.delays[this.imageAnimation.currentFrame]

    if (timeSinceLastFrame >= currentDelay) {
      this.imageAnimation.currentFrame = (this.imageAnimation.currentFrame + 1) % this.imageAnimation.frames.length
      this.imageAnimation.lastFrameTime = now

      // Update the texture with the new frame
      const currentFrameCanvas = this.imageAnimation.frames[this.imageAnimation.currentFrame]
      this.piecesShaderWrapper.updatePuzzleTexture(currentFrameCanvas)
      this.bgShaderWrapper.updatePreviewTexture(currentFrameCanvas)
    }
  }

  public hasImageAnimation(): boolean {
    return this.imageAnimation !== null && this.imageAnimation.frames.length > 1
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

    // Update animation if present
    this.updateImageAnimation()

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
