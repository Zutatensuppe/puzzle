import Debug from './Debug'
import GameCommon from './GameCommon'
import { Dim, Point, Rect } from './Geometry'
import { FireworksInterface, FixedLengthArray, GraphicsInterface, Piece, Player, PlayerCursorsInterface, PlayerSettingsData, PuzzleStatusInterface, PuzzleTableInterface, Timestamp } from './Types'
import { Camera } from './Camera'
import PuzzleGraphics from './PuzzleGraphics'
import { logger } from './Util'

const log = logger('Renderer.ts')

const bitmapsCache: Record<string, ImageBitmap[]> = {}

export class Renderer {
  public debug: boolean = false
  public boundingBoxes: boolean = false

  private ctx: CanvasRenderingContext2D
  private bitmaps!: ImageBitmap[]

  private tableBounds!: Rect
  private boardPos!: Point
  private boardDim!: Dim
  private pieceDim!: Dim
  private pieceDrawOffset!: number

  // we can cache the whole background when we are in lockMovement mode
  private backgroundCache: ImageData | null = null

  constructor(
    protected readonly gameId: string,
    protected readonly canvas: HTMLCanvasElement,
    protected readonly viewport: Camera,
    protected readonly fireworks: FireworksInterface,
    protected readonly puzzleTable: PuzzleTableInterface,
    protected readonly lockMovement: boolean,
  ) {
    this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D

    this.pieceDrawOffset = GameCommon.getPieceDrawOffset(this.gameId)
    this.boardDim = GameCommon.getBoardDim(this.gameId)
    this.boardPos = GameCommon.getBoardPos(this.gameId)
    this.pieceDim = GameCommon.getPieceDim(this.gameId)
    this.tableBounds = GameCommon.getBounds(this.gameId)
  }

  async init (graphics: GraphicsInterface) {
    if (!bitmapsCache[this.gameId]) {
      bitmapsCache[this.gameId] = await PuzzleGraphics.loadPuzzleBitmaps(
        GameCommon.getPuzzle(this.gameId),
        GameCommon.getImageUrl(this.gameId),
        graphics,
      )
    }
    this.bitmaps = bitmapsCache[this.gameId]
  }

  async loadTableTexture (settings: PlayerSettingsData): Promise<void> {
    await this.puzzleTable.loadTexture(this.gameId, settings)
  }

  async render (
    ts: Timestamp,
    settings: PlayerSettingsData,
    playerCursors: PlayerCursorsInterface,
    puzzleStatus: PuzzleStatusInterface,
    shouldDrawPiece: (piece: Piece) => boolean,
    shouldDrawPlayer: (player: Player) => boolean,
    renderFireworks: boolean,
  ) {
    let pos: Point
    let dim: Dim
    let bmp: ImageBitmap

    if (this.debug) Debug.checkpoint_start(0)

    if (this.backgroundCache) {
      this.ctx.putImageData(this.backgroundCache, 0, 0)
      if (this.debug) Debug.checkpoint('clear/table/board done')
    } else {
      // CLEAR CTX
      // ---------------------------------------------------------------
      this.ctx.fillStyle = settings.background
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
      if (this.debug) Debug.checkpoint('clear done')
      // ---------------------------------------------------------------


      // DRAW TABLE
      // ---------------------------------------------------------------
      if (settings.showTable) {
        const tableImg = this.puzzleTable.getImage(this.gameId, settings)
        if (tableImg) {
          pos = this.viewport.worldToViewportRaw(this.tableBounds)
          dim = this.viewport.worldDimToViewportRaw(this.tableBounds)
          this.ctx.drawImage(tableImg, pos.x, pos.y, dim.w, dim.h)
        } else {
          // not logging, otherwise there would be too many log entries
          // in case the player uses a broken custom texture
          // log.info('unable to get table image', settings.tableTexture)
        }
      }
      if (this.debug) Debug.checkpoint('table done')


      // DRAW BOARD
      // ---------------------------------------------------------------
      if (!settings.showTable) {
        pos = this.viewport.worldToViewportRaw(this.boardPos)
        dim = this.viewport.worldDimToViewportRaw(this.boardDim)
        this.ctx.fillStyle = 'rgba(255, 255, 255, .3)'
        this.ctx.fillRect(pos.x, pos.y, dim.w, dim.h)
      }
      if (this.debug) Debug.checkpoint('board done')
      // ---------------------------------------------------------------

      if (this.lockMovement) {
        this.backgroundCache = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height)
      }
    }

    // DRAW PIECES
    // ---------------------------------------------------------------
    const pieces = GameCommon.getPiecesSortedByZIndex(this.gameId)
    if (this.debug) Debug.checkpoint('get pieces done')

    dim = this.viewport.worldDimToViewportRaw(this.pieceDim)
    for (const piece of pieces) {
      if (!shouldDrawPiece(piece)) {
        continue
      }
      bmp = this.bitmaps[piece.idx]
      pos = this.viewport.worldToViewportRaw({
        x: this.pieceDrawOffset + piece.pos.x,
        y: this.pieceDrawOffset + piece.pos.y,
      })

      this.ctx.drawImage(bmp,
        0, 0, bmp.width, bmp.height,
        pos.x, pos.y, dim.w, dim.h,
      )
      if (this.boundingBoxes) this.ctx.strokeRect(pos.x, pos.y, dim.w, dim.h)
    }
    if (this.debug) Debug.checkpoint('pieces done')
    // ---------------------------------------------------------------


    // DRAW PLAYERS
    // ---------------------------------------------------------------
    const texts: Array<FixedLengthArray<[string, number, number]>> = []
    // Cursors
    for (const p of GameCommon.getActivePlayers(this.gameId, ts)) {
      if (shouldDrawPlayer(p)) {
        bmp = await playerCursors.get(p)
        pos = this.viewport.worldToViewport(p)
        this.ctx.drawImage(bmp, pos.x - playerCursors.CURSOR_W_2, pos.y - playerCursors.CURSOR_H_2)
        if (this.boundingBoxes) this.ctx.strokeRect(pos.x - bmp.width / 2, pos.y - bmp.height / 2, bmp.width, bmp.height)
        if (settings.showPlayerNames) {
          // performance:
          // not drawing text directly here, to have less ctx
          // switches between drawImage and fillTxt
          texts.push([`${p.name} (${p.points})`, pos.x, pos.y + playerCursors.CURSOR_H])
        }
      }
    }

    // Names
    this.ctx.fillStyle = 'white'
    this.ctx.textAlign = 'center'
    for (const [txt, x, y] of texts) {
      this.ctx.fillText(txt, x, y)
    }

    if (this.debug) Debug.checkpoint('players done')

    // propagate HUD changes
    // ---------------------------------------------------------------
    puzzleStatus.update(ts)
    if (this.debug) Debug.checkpoint('HUD done')
    // ---------------------------------------------------------------

    if (renderFireworks) {
      this.fireworks.render()
    }
  }
}
