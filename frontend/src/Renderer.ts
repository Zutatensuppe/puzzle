import Debug from '../../common/src/Debug'
import GameCommon from '../../common/src/GameCommon'
import { Dim, Point, Rect } from '../../common/src/Geometry'
import { FireworksInterface, FixedLengthArray, Piece, PieceRotation, Player, PlayerSettingsData, PuzzleStatusInterface, Timestamp } from '../../common/src/Types'
import { Camera } from '../../common/src/Camera'
import PuzzleGraphics from './PuzzleGraphics'
import { logger } from '../../common/src/Util'
import { PlayerCursors } from './PlayerCursors'
import { PuzzleTable } from './PuzzleTable'
import { Graphics } from './Graphics'

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

  constructor(
    protected readonly gameId: string,
    protected readonly fireworks: FireworksInterface | null,
    protected readonly puzzleTable: PuzzleTable | null,
    protected readonly lockMovement: boolean,
  ) {
    this.pieceDrawOffset = GameCommon.getPieceDrawOffset(this.gameId)
    this.boardDim = GameCommon.getBoardDim(this.gameId)
    this.boardPos = GameCommon.getBoardPos(this.gameId)
    this.pieceDim = GameCommon.getPieceDim(this.gameId)
    this.tableBounds = GameCommon.getBounds(this.gameId)
  }

  async init (graphics: Graphics) {
    if (!puzzleBitmapCache[this.gameId]) {
      // log.log('loading puzzle bitmap', this.gameId)
      puzzleBitmapCache[this.gameId] = await PuzzleGraphics.loadPuzzleBitmap(
        GameCommon.getPuzzle(this.gameId),
        GameCommon.getImageUrl(this.gameId),
        graphics,
      )
    }
    if (!pieceBitmapsCache[this.gameId]) {
      // log.log('loading piece bitmaps', this.gameId)
      pieceBitmapsCache[this.gameId] = PuzzleGraphics.loadPuzzleBitmaps(
        puzzleBitmapCache[this.gameId],
        GameCommon.getPuzzle(this.gameId),
        graphics,
      )
    }
    if (!puzzleBitmapGrayscaled[this.gameId]) {
      // log.log('loading grayscaled puzzle bitmap', this.gameId)
      const bmpGrayscaled = graphics.grayscaledCanvas(
        puzzleBitmapCache[this.gameId],
        'black',
        0.3,
      )
      puzzleBitmapGrayscaled[this.gameId] = bmpGrayscaled
    }
  }

  async loadTableTexture (settings: PlayerSettingsData): Promise<void> {
    if (this.puzzleTable) {
      await this.puzzleTable.loadTexture(this.gameId, settings)
    }
  }

  async render (
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    viewport: Camera,
    ts: Timestamp,
    settings: PlayerSettingsData,
    playerCursors: PlayerCursors | null,
    puzzleStatus: PuzzleStatusInterface,
    shouldDrawPiece: (piece: Piece) => boolean,
    shouldDrawPlayer: (player: Player) => boolean,
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
      if (renderPreview) {
        pos = viewport.worldToViewportRaw(this.boardPos)
        dim = viewport.worldDimToViewportRaw(this.boardDim)
        ctx.drawImage(puzzleBitmapGrayscaled[this.gameId], pos.x, pos.y, dim.w, dim.h)
      } else if (!settings.showTable || !this.puzzleTable) {
        pos = viewport.worldToViewportRaw(this.boardPos)
        dim = viewport.worldDimToViewportRaw(this.boardDim)
        ctx.fillStyle = 'rgba(255, 255, 255, .3)'
        ctx.fillRect(pos.x, pos.y, dim.w, dim.h)
      }
      if (this.debug) Debug.checkpoint('preview/board done')
      // ---------------------------------------------------------------

      if (this.lockMovement) {
        this.backgroundCache = ctx.getImageData(0, 0, canvas.width, canvas.height)
      }
    }

    // DRAW PIECES
    // ---------------------------------------------------------------
    const pieces = GameCommon.getPiecesSortedByZIndex(this.gameId)
    if (this.debug) Debug.checkpoint('get pieces done')

    dim = viewport.worldDimToViewportRaw(this.pieceDim)
    for (const piece of pieces) {
      if (!shouldDrawPiece(piece)) {
        continue
      }
      tmpCanvas = pieceBitmapsCache[this.gameId][piece.idx]
      pos = viewport.worldToViewportRaw({
        x: this.pieceDrawOffset + piece.pos.x,
        y: this.pieceDrawOffset + piece.pos.y,
      })

      let rot = 0
      if (piece.rot === PieceRotation.R90) {
        rot = Math.PI/2
      } else if (piece.rot === PieceRotation.R180) {
        rot = Math.PI
      } else if (piece.rot === PieceRotation.R270) {
        rot = -Math.PI/2
      }
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
      const texts: FixedLengthArray<[string, number, number]>[] = []
      // Cursors
      const players = GameCommon.getActivePlayers(this.gameId, ts)
      for (const p of players) {
        if (shouldDrawPlayer(p)) {
          bmp = await playerCursors.get(p)
          pos = viewport.worldToViewport(p)
          ctx.drawImage(bmp, pos.x - playerCursors.CURSOR_W_2, pos.y - playerCursors.CURSOR_H_2)
          if (this.boundingBoxes) ctx.strokeRect(pos.x - bmp.width / 2, pos.y - bmp.height / 2, bmp.width, bmp.height)
          if (settings.showPlayerNames) {
            // performance:
            // not drawing text directly here, to have less ctx
            // switches between drawImage and fillTxt
            texts.push([`${p.name} (${p.points})`, pos.x, pos.y + playerCursors.CURSOR_H])
          }
          if (this.debug) Debug.checkpoint(`drew player ${p.name} at ${pos.x},${pos.y}`)
        } else {
          if (this.debug) Debug.checkpoint(`skipped player ${p.name}`)
        }
      }

      // Names
      ctx.fillStyle = 'white'
      ctx.textAlign = 'center'
      for (const [txt, x, y] of texts) {
        ctx.fillText(txt, x, y)
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
}
