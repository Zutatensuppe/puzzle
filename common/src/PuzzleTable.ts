import { Dim, Point, Rect } from './Geometry'
import GameCommon from './GameCommon'
import { GraphicsInterface, PlayerSettingsData, PuzzleTableInterface } from './Types'
import { logger } from './Util'

const log = logger('PuzzleTable.ts')

export class PuzzleTable implements PuzzleTableInterface {
  private images: Record<string, ImageBitmap | null> = {}
  private bounds: Rect
  private boardPos: Point
  private boardDim: Dim

  constructor(
    gameId: string,
    private graphics: GraphicsInterface,
  ) {
    this.bounds = GameCommon.getBounds(gameId)
    const tableWidth = GameCommon.getTableWidth(gameId)
    const tableHeight = GameCommon.getTableHeight(gameId)
    const puzzleWidth = GameCommon.getPuzzleWidth(gameId)
    const puzzleHeight = GameCommon.getPuzzleHeight(gameId)

    this.boardPos = {
      x: (tableWidth - puzzleWidth) / 2,
      y: (tableHeight - puzzleHeight) / 2,
    }
    this.boardDim = {
      w: puzzleWidth,
      h: puzzleHeight,
    }
  }

  async loadTexture(settings: PlayerSettingsData): Promise<ImageBitmap | null> {
    const textureNameOrUrl = settings.useCustomTableTexture ? settings.customTableTexture : settings.tableTexture
    if (!textureNameOrUrl) {
      return null
    }
    const scale = settings.useCustomTableTexture ? settings.customTableTextureScale : 1 // determined later, but always fixed for cache key
    const cacheKey = textureNameOrUrl + '___' + scale
    if (this.images[cacheKey]) {
      return this.images[cacheKey]
    }
    if (this.images[cacheKey] === null) {
      return null
    }

    this.images[cacheKey] = null

    const map: Record<string, { url: string, scale: number, isDark: boolean }> = {
      dark: { url: '/assets/textures/wood-dark.jpg', scale: 1.5, isDark: true },
      light: { url: '/assets/textures/wood-light.jpg', scale: 1.5, isDark: false },
      brown: { url: '/assets/textures/Oak-none-3275x2565mm-Architextures.jpg', scale: 2.5, isDark: true },
      aiwood: { url: '/assets/textures/ai-wood.png', scale: 1.5, isDark: true },
    }

    const obj = textureNameOrUrl in map
      ? map[textureNameOrUrl]
      // TODO: dark or light could be determined by the image? or another setting prop
      : { url: textureNameOrUrl, scale, isDark: false }
    try {
      const bitmap = await this.graphics.loadImageToBitmap(obj.url)
      const texture = await this._createTableGfx(bitmap, obj.scale, obj.isDark)
      this.images[cacheKey] = texture
      return this.images[cacheKey]
    } catch (e) {
      log.error(e)
      return null
    }
  }

  getImage(settings: PlayerSettingsData): ImageBitmap | null {
    const textureNameOrUrl = settings.useCustomTableTexture ? settings.customTableTexture : settings.tableTexture
    const scale = settings.useCustomTableTexture ? settings.customTableTextureScale : 1 // determined later, but always fixed for cache key
    const cacheKey = textureNameOrUrl + '___' + scale
    return this.images[cacheKey] || null
  }

  async _createTableGfx(
    bitmap: ImageBitmap,
    scale: number,
    isDark: boolean,
  ): Promise<ImageBitmap> {
    const tableCanvas = this.graphics.repeat(bitmap, this.bounds, scale)
    const adjustedBounds: Dim = { w: tableCanvas.width, h: tableCanvas.height }
    const ratio = adjustedBounds.w / this.bounds.w
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

    return await this.graphics.createImageBitmapFromCanvas(tableCanvas)
  }
}
