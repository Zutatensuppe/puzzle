import { Dim, Point, Rect } from '../../common/src/Geometry'
import { Assets } from './Assets'
import Graphics from './Graphics'

export class PuzzleTable {
  private images: Record<string, CanvasImageSource> = {}

  constructor(
    private bounds: Rect,
    private assets: Assets,
    private boardPos: Point,
    private boardDim: Dim,
  ) {
    // pass
  }

  async init() {
    this.images['dark'] = await this._createTableGfx(this.assets.Textures.WOOD_DARK, true)
    this.images['light'] = await this._createTableGfx(this.assets.Textures.WOOD_LIGHT, false)
    this.images['brown'] = await this._createTableGfx(this.assets.Textures.OAK_BROWN, true)
  }

  getImage(textureName: string): CanvasImageSource | undefined {
    return this.images[textureName]
  }

  async _createTableGfx (bitmap: ImageBitmap, isDark: boolean): Promise<CanvasImageSource> {
    const tableCanvas = Graphics.repeat(bitmap, this.bounds, 3)

    const adjustedBounds: Dim = { w: tableCanvas.width, h: tableCanvas.height }
    const ratio = adjustedBounds.w /this.bounds.w

    const tableCtx = tableCanvas.getContext('2d') as CanvasRenderingContext2D

    // darken the outer edges of the table a bit
    {
      const border = { w: 16, h: 16 }
      tableCtx.fillStyle = 'rgba(0, 0, 0, .5)'

      tableCtx.fillRect(
        0,
        0,
        adjustedBounds.w,
        border.h,
      )
      tableCtx.fillRect(
        0,
        0 + border.h,
        border.w,
        adjustedBounds.h - 2 * border.h,
      )
      tableCtx.fillRect(
        0 + adjustedBounds.w - border.w,
        0 + border.h,
        border.w,
        adjustedBounds.h - 2 * border.h,
      )
      tableCtx.fillRect(
        0,
        0 + adjustedBounds.h - border.h,
        adjustedBounds.w,
        border.w,
      )
    }

    const boardX = -this.bounds.x + this.boardPos.x
    const boardY = -this.bounds.y + this.boardPos.y

    // darken the place where the puzzle should be at the end a bit
    {
      const border = { w: 8, h: 8 }
      tableCtx.fillStyle = 'rgba(0, 0, 0, .5)'
      tableCtx.fillRect(
        ratio * (boardX - border.w),
        ratio * (boardY - border.h),
        ratio * (this.boardDim.w + 2 * border.w),
        ratio * border.h,
      )
      tableCtx.fillRect(
        ratio * (boardX - border.w),
        ratio * boardY,
        ratio * border.h,
        ratio * this.boardDim.h,
      )
      tableCtx.fillRect(
        ratio * (boardX + this.boardDim.w),
        ratio * (boardY),
        ratio * border.w,
        ratio * this.boardDim.h,
      )
      tableCtx.fillRect(
        ratio * (boardX - border.w),
        ratio * (boardY + this.boardDim.h),
        ratio * (this.boardDim.w + 2 * border.w),
        ratio * border.h,
      )
    }

    // draw the board
    {
      tableCtx.fillStyle = isDark ? 'rgba(0, 0, 0, .3)' : 'rgba(255, 255, 255, .3)'
      tableCtx.fillRect(
        ratio * boardX,
        ratio * boardY,
        ratio * this.boardDim.w,
        ratio * this.boardDim.h,
      )
    }

    return await createImageBitmap(tableCanvas)
  }
}
