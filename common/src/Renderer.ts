import Debug from './Debug'
import GameCommon from './GameCommon'
import { Dim, Point, Rect } from './Geometry'
import { FireworksInterface, FixedLengthArray, GraphicsInterface, Piece, Player, PlayerCursorsInterface, PlayerSettingsData, PuzzleStatusInterface, PuzzleTableInterface, Timestamp } from './Types'
// import fireworksController from './Fireworks'
import { Camera } from './Camera'
import PuzzleGraphics from './PuzzleGraphics'

let BUFF: any = null
export class Renderer {
  public debug: boolean = false

  // private fireworks!: fireworksController
  private ctx: CanvasRenderingContext2D
  private bitmaps!: ImageBitmap[]
  public puzzleTable!: PuzzleTableInterface

  private tableDim!: Dim
  private tableBounds!: Rect
  private boardPos!: Point
  private boardDim!: Dim
  private pieceDim!: Dim
  private pieceDrawOffset!: number

  constructor(
    protected readonly gameId: string,
    protected readonly canvas: HTMLCanvasElement,
    protected readonly viewport: Camera,
    protected readonly fireworks: FireworksInterface,
  ) {
    this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D

    this.pieceDrawOffset = GameCommon.getPieceDrawOffset(this.gameId)
    const pieceDrawSize = GameCommon.getPieceDrawSize(this.gameId)
    const puzzleWidth = GameCommon.getPuzzleWidth(this.gameId)
    const puzzleHeight = GameCommon.getPuzzleHeight(this.gameId)
    const tableWidth = GameCommon.getTableWidth(this.gameId)
    const tableHeight = GameCommon.getTableHeight(this.gameId)
    this.tableDim = {
      w: tableWidth,
      h: tableHeight,
    }
    this.boardPos = {
      x: (this.tableDim.w - puzzleWidth) / 2,
      y: (this.tableDim.h - puzzleHeight) / 2,
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
  }

  async init (windowDim: Dim, graphics: GraphicsInterface) {
    this.bitmaps = await PuzzleGraphics.loadPuzzleBitmaps(
      GameCommon.getPuzzle(this.gameId),
      GameCommon.getImageUrl(this.gameId),
      graphics,
    )
    this.viewport.calculateZoomCapping(windowDim, this.tableDim)
    this.viewport.centerFit(
      { w: this.canvas.width, h: this.canvas.height },
      this.tableDim,
      this.boardDim,
    )
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

    if (!BUFF) {
      // CLEAR CTX
      // ---------------------------------------------------------------
      this.ctx.fillStyle = settings.background
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
      if (this.debug) Debug.checkpoint('clear done')
      // ---------------------------------------------------------------


      // DRAW TABLE
      // ---------------------------------------------------------------
      if (settings.showTable) {
        const tableImg = this.puzzleTable.getImage(settings.tableTexture)
        if (tableImg) {
          pos = this.viewport.worldToViewportRaw(this.tableBounds)
          dim = this.viewport.worldDimToViewportRaw(this.tableBounds)
          this.ctx.drawImage(tableImg, pos.x, pos.y, dim.w, dim.h)
        }
      }
      if (this.debug) Debug.checkpoint('table done')
      // ---------------------------------------------------------------
      BUFF = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height)
    } else {
      this.ctx.putImageData(BUFF, 0, 0)
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
