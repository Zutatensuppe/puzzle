import Debug from '@common/Debug'
import GameCommon from '@common/GameCommon'
import type { Dim, Point, Rect } from '@common/Geometry'
import { PieceRotation, EncodedPieceIdx, EncodedPlayerIdx } from '@common/Types'
import type { EncodedPiece, EncodedPlayer, FireworksInterface, GameId, ImageFrameMeta, PlayerSettingsData, PuzzleInfo, PuzzleStatusInterface, Timestamp } from '@common/Types'
import { Camera } from '@common/Camera'
import PuzzleGraphics from './PuzzleGraphics'
import type { PieceShapeSheets } from './PuzzleGraphics'
import { AnimatedImageLoader } from './AnimatedImageLoader'
import { FrameClock } from './FrameClock'
import { ParityAtlas } from './ParityAtlas'
import Util, { logger } from '@common/Util'
import type { PlayerCursors } from './PlayerCursors'
import type { PuzzleTable } from './PuzzleTable'
import type { Graphics } from './Graphics'
import { getPlayerNameCanvas } from './PlayerNames'

const log = logger('Renderer.ts')

const pieceBitmapsCache: Record<string, HTMLCanvasElement[]> = {}
const puzzleBitmapCache: Record<string, HTMLCanvasElement> = {}
const puzzleBitmapGrayscaled: Record<string, HTMLCanvasElement> = {}

interface ImageAnimationState {
  // in native resolution, scaled only when drawn into the atlas
  frames: HTMLCanvasElement[]
  clock: FrameClock
  atlas: ParityAtlas
  // grayscale preview of the shown Frame, in native resolution
  grayscale: HTMLCanvasElement
}

const imageAnimationStates: Record<string, ImageAnimationState> = {}
const imageFramesChecked: Record<string, boolean> = {}

// image independent, so built once per session (per piece size)
const pieceShapeSheetsCache: Record<number, PieceShapeSheets> = {}

// the bevel shading is invisible on pieces smaller than this on screen
const SHADING_MIN_PIECE_SIZE_PX = 12

const GRAYSCALE_BACKGROUND = 'black'
const GRAYSCALE_OPACITY = 0.3

export class Renderer {
  public debug: boolean = false
  public boundingBoxes: boolean = false

  private tableBounds!: Rect
  private boardPos!: Point
  private boardDim!: Dim
  private pieceDim!: Dim
  private pieceDrawOffset!: number

  // we can cache the whole background when we are in lockMovement mode
  private backgroundCache: ImageData | null = null

  private static RotationMap: Record<PieceRotation, number> = {
    [PieceRotation.R0]: 0,
    [PieceRotation.R90]: Math.PI / 2,
    [PieceRotation.R180]: Math.PI,
    [PieceRotation.R270]: -Math.PI / 2,
  }

  constructor(
    protected readonly gameId: GameId,
    protected readonly fireworks: FireworksInterface | null,
    protected readonly puzzleTable: PuzzleTable | null,
    protected readonly lockMovement: boolean,
    protected readonly graphics: Graphics,
  ) {
    this.pieceDrawOffset = GameCommon.getPieceDrawOffset(this.gameId)
    this.boardDim = GameCommon.getBoardDim(this.gameId)
    this.boardPos = GameCommon.getBoardPos(this.gameId)
    this.pieceDim = GameCommon.getPieceDim(this.gameId)
    this.tableBounds = GameCommon.getBounds(this.gameId)
  }

  private static isOnCanvas(pos: Point, dim: Dim, canvas: HTMLCanvasElement): boolean {
    if (pos.x > canvas.width || pos.y > canvas.height) {
      return false
    }
    return !(pos.x + dim.w < 0 || pos.y + dim.h < 0)
  }

  async init() {
    if (!puzzleBitmapCache[this.gameId]) {
      puzzleBitmapCache[this.gameId] = await PuzzleGraphics.loadPuzzleBitmap(
        GameCommon.getPuzzle(this.gameId),
        GameCommon.getImageUrl(this.gameId),
        this.graphics,
      )
    }

    // Set up image animation if this image carries pre-extracted frames.
    // We try this before building the static piece/grayscale caches so we can
    // skip that work entirely for animated images (the animation provides its
    // own per-frame piece bitmaps and grayscale previews).
    const animatedImageMeta = GameCommon.getImage(this.gameId).animationFrames
    if (animatedImageMeta && animatedImageMeta.length > 1 && !imageAnimationStates[this.gameId] && !imageFramesChecked[this.gameId]) {
      imageFramesChecked[this.gameId] = true
      await this.initImageAnimation(animatedImageMeta)
    }

    const hasAnim = !!imageAnimationStates[this.gameId]

    if (!hasAnim && !pieceBitmapsCache[this.gameId]) {
      pieceBitmapsCache[this.gameId] = PuzzleGraphics.loadPuzzleBitmaps(
        puzzleBitmapCache[this.gameId],
        GameCommon.getPuzzle(this.gameId),
        this.graphics,
      )
    }

    if (!hasAnim && !puzzleBitmapGrayscaled[this.gameId]) {
      puzzleBitmapGrayscaled[this.gameId] = this.graphics.op.toGrayscale(
        puzzleBitmapCache[this.gameId],
        GRAYSCALE_BACKGROUND,
        GRAYSCALE_OPACITY,
      )
    }
  }

  private pieceShapeSheets(info: PuzzleInfo): PieceShapeSheets {
    return pieceShapeSheetsCache[info.tileSize] ??= PuzzleGraphics.createPieceShapeSheets(info, this.graphics)
  }

  private async initImageAnimation(metas: ImageFrameMeta[]): Promise<void> {
    try {
      const animatedImageLoader = AnimatedImageLoader.getInstance()
      const imageFrames = await animatedImageLoader.loadFrames(metas)

      const info = GameCommon.getPuzzle(this.gameId).info
      const frames = imageFrames.map(frame => frame.canvas)
      const durations = imageFrames.map(frame => frame.delay)

      const atlas = ParityAtlas.create(info, this.pieceShapeSheets(info), this.graphics)
      const grayscale = this.graphics.createCanvas(frames[0].width, frames[0].height)
      const clock = new FrameClock(durations, performance.now())
      imageAnimationStates[this.gameId] = { frames, clock, atlas, grayscale }
      this.showAnimationFrame(imageAnimationStates[this.gameId])

      log.log(`Image animation initialized with ${frames.length} frames`)
    } catch (e) {
      log.error('Failed to load animated frames:', e)
    }
  }

  private updateImageAnimation(): void {
    const anim = imageAnimationStates[this.gameId]
    if (anim && anim.clock.update(performance.now())) {
      this.showAnimationFrame(anim)
    }
  }

  private showAnimationFrame(anim: ImageAnimationState): void {
    const frame = anim.frames[anim.clock.frame]
    anim.atlas.update(frame)

    // grayscale of the Frame on a black background, like toGrayscale(): the
    // luminosity blend of a colour onto black is its gray
    const ctx = anim.grayscale.getContext('2d')!
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
    ctx.fillStyle = GRAYSCALE_BACKGROUND
    ctx.fillRect(0, 0, anim.grayscale.width, anim.grayscale.height)
    ctx.globalCompositeOperation = 'luminosity'
    ctx.globalAlpha = GRAYSCALE_OPACITY
    ctx.drawImage(frame, 0, 0, anim.grayscale.width, anim.grayscale.height)
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
  }

  async loadTableTexture(settings: PlayerSettingsData): Promise<void> {
    if (this.puzzleTable) {
      await this.puzzleTable.loadTextureToCanvas(this.gameId, settings)
    }
  }

  render(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    viewport: Camera,
    ts: Timestamp,
    settings: PlayerSettingsData,
    playerCursors: PlayerCursors | null,
    puzzleStatus: PuzzleStatusInterface,
    shouldDrawEncodedPiece: (piece: EncodedPiece) => boolean,
    shouldDrawPlayer: (player: EncodedPlayer) => boolean,
    renderFireworks: boolean,
    renderPreview: boolean,
  ) {
    let pos: Point
    let dim: Dim
    let bmp: HTMLCanvasElement
    let srcCanvas: HTMLCanvasElement
    let srcX: number
    let srcY: number
    let srcSize: number

    if (this.debug) Debug.checkpoint_start(0)

    this.updateImageAnimation()

    const anim = imageAnimationStates[this.gameId]
    const animatedPreview = !!anim && renderPreview && settings.showPuzzleBackground

    if (this.backgroundCache && !animatedPreview) {
      ctx.putImageData(this.backgroundCache, 0, 0)
      if (this.debug) Debug.checkpoint('clear/table/board done - cached')
    } else {
      // CLEAR CTX
      // ---------------------------------------------------------------
      ctx.fillStyle = settings.background
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      if (this.debug) Debug.checkpoint('clear done')
      // ---------------------------------------------------------------


      // DRAW TABLE
      // ---------------------------------------------------------------
      if (settings.showTable && this.puzzleTable) {
        const tableImg = this.puzzleTable.getImage(this.gameId, settings)
        if (tableImg) {
          pos = viewport.worldToViewportRaw(this.tableBounds)
          dim = viewport.worldDimToViewportRaw(this.tableBounds)
          ctx.drawImage(tableImg, pos.x, pos.y, dim.w, dim.h)
        } else {
          // not logging, otherwise there would be too many log entries
          // in case the player uses a broken custom texture
          // log.info('unable to get table image', settings.tableTexture)
        }
      }
      if (this.debug) Debug.checkpoint('table done')

      // DRAW PREVIEW or BOARD
      // ---------------------------------------------------------------
      if (renderPreview && settings.showPuzzleBackground) {
        pos = viewport.worldToViewportRaw(this.boardPos)
        dim = viewport.worldDimToViewportRaw(this.boardDim)
        const grayscale = anim?.grayscale ?? puzzleBitmapGrayscaled[this.gameId]
        ctx.drawImage(grayscale, pos.x, pos.y, dim.w, dim.h)
      } else if (!settings.showTable || !this.puzzleTable) {
        pos = viewport.worldToViewportRaw(this.boardPos)
        dim = viewport.worldDimToViewportRaw(this.boardDim)

        // board background
        if (settings.showPuzzleBackground) {
          ctx.fillStyle = 'rgba(255, 255, 255, .3)'
          ctx.fillRect(pos.x, pos.y, dim.w, dim.h)
        }

        // board border
        {
          const border = viewport.worldDimToViewportRaw({ w: 8, h: 8 })
          ctx.fillStyle = 'rgba(0, 0, 0, .5)'
          ctx.fillRect(pos.x - border.w, pos.y - border.h, dim.w + 2 * border.w, border.h)
          ctx.fillRect(pos.x - border.w, pos.y, border.w, dim.h)
          ctx.fillRect(pos.x + dim.w, pos.y, border.w, dim.h)
          ctx.fillRect(pos.x - border.w, pos.y + dim.h, dim.w + 2 * border.w, border.h)
        }
      }
      if (this.debug) Debug.checkpoint('preview/board done')
      // ---------------------------------------------------------------

      if (this.lockMovement && !animatedPreview) {
        this.backgroundCache = ctx.getImageData(0, 0, canvas.width, canvas.height)
      }
    }

    // DRAW PIECES
    // ---------------------------------------------------------------
    const pieces = GameCommon.getEncodedPiecesSortedByZIndex(this.gameId)
    if (this.debug) Debug.checkpoint('get pieces done')

    dim = viewport.worldDimToViewportRaw(this.pieceDim)
    const info = GameCommon.getPuzzle(this.gameId).info
    const shapeSheets = anim && dim.w * info.tileSize / info.tileDrawSize >= SHADING_MIN_PIECE_SIZE_PX
      ? this.pieceShapeSheets(info)
      : null
    for (const piece of pieces) {
      if (!shouldDrawEncodedPiece(piece)) {
        continue
      }

      pos = viewport.worldToViewportRaw({
        x: this.pieceDrawOffset + piece[EncodedPieceIdx.POS_X],
        y: this.pieceDrawOffset + piece[EncodedPieceIdx.POS_Y],
      })
      if (!Renderer.isOnCanvas(pos, dim, canvas)) {
        continue
      }

      const pieceIdx = piece[EncodedPieceIdx.IDX]
      const rotation = piece[EncodedPieceIdx.ROTATION] || PieceRotation.R0
      if (anim) {
        const src = anim.atlas.source(pieceIdx)
        srcCanvas = src.sheet
        srcX = src.x
        srcY = src.y
        srcSize = src.size
      } else {
        srcCanvas = pieceBitmapsCache[this.gameId][pieceIdx]
        srcX = 0
        srcY = 0
        srcSize = srcCanvas.width
      }

      const rot = Renderer.RotationMap[rotation]
      if (rot) {
        ctx.save()
        ctx.translate(pos.x + dim.w / 2, pos.y + dim.h / 2)
        ctx.rotate(rot)
        ctx.drawImage(srcCanvas,
          srcX, srcY, srcSize, srcSize,
          -dim.w / 2, -dim.h / 2, dim.w, dim.h,
        )
        ctx.restore()
      } else {
        ctx.drawImage(srcCanvas,
          srcX, srcY, srcSize, srcSize,
          pos.x, pos.y, dim.w, dim.h,
        )
      }

      if (shapeSheets) {
        // the shading of the rotated shape, drawn unrotated: the light
        // always comes from the top left, whatever the rotation
        const shadePos = shapeSheets.positions[Util.rotateEncodedShape(info.shapes[pieceIdx], rotation)]
        ctx.drawImage(shapeSheets.shade,
          shadePos.x, shadePos.y, shapeSheets.pieceDrawSize, shapeSheets.pieceDrawSize,
          pos.x, pos.y, dim.w, dim.h,
        )
      }
      if (this.boundingBoxes) ctx.strokeRect(pos.x, pos.y, dim.w, dim.h)
    }
    if (this.debug) Debug.checkpoint('pieces done')
    // ---------------------------------------------------------------


    // DRAW PLAYERS
    // ---------------------------------------------------------------
    if (playerCursors) {
      // Cursors
      const players = GameCommon.getActivePlayers(this.gameId, ts)
      for (const p of players) {
        if (shouldDrawPlayer(p)) {
          bmp = playerCursors.get(p)
          pos = viewport.worldToViewportXy(p[EncodedPlayerIdx.X], p[EncodedPlayerIdx.Y])
          ctx.drawImage(bmp, pos.x - playerCursors.CURSOR_W_2, pos.y - playerCursors.CURSOR_H_2)
          if (this.boundingBoxes) ctx.strokeRect(pos.x - bmp.width / 2, pos.y - bmp.height / 2, bmp.width, bmp.height)
          if (settings.showPlayerNames) {
            const cacheEntry = getPlayerNameCanvas(this.graphics, p)
            if (cacheEntry) {
              ctx.drawImage(
                cacheEntry.canvas,
                pos.x - (cacheEntry.canvas.width / 2),
                pos.y + 16 - (cacheEntry.canvas.height - cacheEntry.fontHeight),
              )
            }
          }
          if (this.debug) Debug.checkpoint(`drew player ${p[EncodedPlayerIdx.NAME]} at ${pos.x},${pos.y}`)
        } else {
          if (this.debug) Debug.checkpoint(`skipped player ${p[EncodedPlayerIdx.NAME]}`)
        }
      }

      if (this.debug) Debug.checkpoint('players done')
    } else {
      if (this.debug) Debug.checkpoint('players skipped')
    }

    // propagate HUD changes
    // ---------------------------------------------------------------
    puzzleStatus.update(ts)
    if (this.debug) Debug.checkpoint('HUD done')
    // ---------------------------------------------------------------

    if (renderFireworks && this.fireworks) {
      this.fireworks.render()
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
  ): string {
    const viewport = new Camera()
    viewport.calculateZoomCapping(boardDim, tableDim)
    viewport.centerFit(boardDim, tableDim, boardDim, 0)

    const canvas = this.graphics.createCanvas(boardDim.w, boardDim.h)
    const ctx = canvas.getContext('2d')!
    this.render(
      canvas,
      ctx,
      viewport,
      ts,
      settings,
      null,
      { update: (_ts: number) => { return } },
      shouldDrawEncodedPiece,
      shouldDrawPlayer,
      false,
      renderPreview,
    )
    return canvas.toDataURL('image/jpeg', 75)
  }

  public hasAnimation(): boolean {
    const anim = imageAnimationStates[this.gameId]
    return !!anim && anim.frames.length > 1
  }

  public isImageAnimationFrameDue(now: number = performance.now()): boolean {
    return imageAnimationStates[this.gameId]?.clock.isFrameChangeDue(now) ?? false
  }
}
