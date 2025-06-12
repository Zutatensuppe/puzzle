import Debug from '../../common/src/Debug'
import GameCommon from '../../common/src/GameCommon'
import type { Dim, Point, Rect } from '../../common/src/Geometry'
import { PieceRotation, EncodedPieceIdx, EncodedPlayerIdx } from '../../common/src/Types'
import type { EncodedPiece, EncodedPlayer, FireworksInterface, GameId, PlayerSettingsData, PuzzleStatusInterface, Timestamp } from '../../common/src/Types'
import { Camera } from '../../common/src/Camera'
import PuzzleGraphics from './PuzzleGraphics'
import { logger } from '../../common/src/Util'
import type { PlayerCursors } from './PlayerCursors'
import type { PuzzleTable } from './PuzzleTable'
import type { Graphics } from './Graphics'
import { getPlayerNameCanvas } from './PlayerNames'

const log = logger('Renderer.ts')

const pieceBitmapsCache: Record<string, HTMLCanvasElement[]> = {}
const puzzleBitmapCache: Record<string, HTMLCanvasElement> = {}
const puzzleBitmapGrayscaled: Record<string, HTMLCanvasElement> = {}

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
    if (pos.x + dim.w < 0 || pos.y + dim.h < 0) {
      return false
    }
    return true
  }

  async init() {
    if (!puzzleBitmapCache[this.gameId]) {
      // log.log('loading puzzle bitmap', this.gameId)
      puzzleBitmapCache[this.gameId] = await PuzzleGraphics.loadPuzzleBitmap(
        GameCommon.getPuzzle(this.gameId),
        GameCommon.getImageUrl(this.gameId),
        this.graphics,
      )
    }
    if (!pieceBitmapsCache[this.gameId]) {
      // log.log('loading piece bitmaps', this.gameId)
      pieceBitmapsCache[this.gameId] = PuzzleGraphics.loadPuzzleBitmaps(
        puzzleBitmapCache[this.gameId],
        GameCommon.getPuzzle(this.gameId),
        this.graphics,
      )
    }
    if (!puzzleBitmapGrayscaled[this.gameId]) {
      // log.log('loading grayscaled puzzle bitmap', this.gameId)
      const bmpGrayscaled = this.graphics.grayscaledCanvas(
        puzzleBitmapCache[this.gameId],
        'black',
        0.3,
      )
      puzzleBitmapGrayscaled[this.gameId] = bmpGrayscaled
    }
  }

  async loadTableTexture(settings: PlayerSettingsData): Promise<void> {
    if (this.puzzleTable) {
      await this.puzzleTable.loadTextureToCanvas(this.gameId, settings)
    }
  }

  render (
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
    let bmp: ImageBitmap | HTMLCanvasElement
    let tmpCanvas: HTMLCanvasElement

    if (this.debug) Debug.checkpoint_start(0)

    if (this.backgroundCache) {
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
        ctx.drawImage(puzzleBitmapGrayscaled[this.gameId], pos.x, pos.y, dim.w, dim.h)
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

      if (this.lockMovement) {
        this.backgroundCache = ctx.getImageData(0, 0, canvas.width, canvas.height)
      }
    }

    // DRAW PIECES
    // ---------------------------------------------------------------
    const pieces = GameCommon.getEncodedPiecesSortedByZIndex(this.gameId)
    if (this.debug) Debug.checkpoint('get pieces done')

    dim = viewport.worldDimToViewportRaw(this.pieceDim)
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

      tmpCanvas = pieceBitmapsCache[this.gameId][piece[EncodedPieceIdx.IDX]]

      const rot = Renderer.RotationMap[piece[EncodedPieceIdx.ROTATION] || PieceRotation.R0]
      if (rot) {
        ctx.save()
        ctx.translate(pos.x + dim.w / 2, pos.y + dim.h / 2)
        ctx.rotate(rot)
        ctx.drawImage(tmpCanvas, -dim.w / 2, -dim.h / 2, dim.w, dim.h)
        ctx.restore()
      } else {
        ctx.drawImage(tmpCanvas,
          0, 0, tmpCanvas.width, tmpCanvas.height,
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
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
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
}
