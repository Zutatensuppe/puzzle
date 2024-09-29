import GameCommon from '../../common/src/GameCommon'
import { Dim, Point, Rect } from './Geometry'
import { GameId, PlayerSettingsData } from '../../common/src/Types'
import { logger } from '../../common/src/Util'
import { Graphics } from './Graphics'

const log = logger('PuzzleTable.ts')

const cache: Record<string, HTMLCanvasElement | null> = {}

export class PuzzleTable {
  constructor(
    private readonly graphics: Graphics,
  ) {}

  public async loadTexture(
    gameId: GameId,
    settings: PlayerSettingsData,
  ): Promise<HTMLCanvasElement | null> {
    const textureNameOrUrl = settings.useCustomTableTexture
      ? settings.customTableTexture
      : settings.tableTexture
    if (!textureNameOrUrl) {
      return null
    }
    const scale = settings.useCustomTableTexture
      ? settings.customTableTextureScale
      : 1 // determined later, but always fixed for cache key
    const cacheKey = `${gameId}___${textureNameOrUrl}___${scale}`
    if (cache[cacheKey]) {
      return cache[cacheKey]
    }
    if (cache[cacheKey] === null) {
      return null
    }

    cache[cacheKey] = null

    const bounds = GameCommon.getBounds(gameId)
    const boardPos = GameCommon.getBoardPos(gameId)
    const boardDim = GameCommon.getBoardDim(gameId)

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
      const texture = this._createTableGfx(bounds, boardPos, boardDim, bitmap, obj.scale, obj.isDark)
      cache[cacheKey] = texture
      return cache[cacheKey]
    } catch (e) {
      log.error('unable to load', obj.url)
      log.error(e)
      return null
    }
  }

  public getImage(
    gameId: GameId,
    settings: PlayerSettingsData,
  ): HTMLCanvasElement | null {
    const textureNameOrUrl = settings.useCustomTableTexture ? settings.customTableTexture : settings.tableTexture
    const scale = settings.useCustomTableTexture ? settings.customTableTextureScale : 1 // determined later, but always fixed for cache key
    const cacheKey = gameId + '___' + textureNameOrUrl + '___' + scale
    return cache[cacheKey] || null
  }

  private _createTableGfx(
    bounds: Rect,
    boardPos: Point,
    boardDim: Dim,
    bitmap: ImageBitmap,
    scale: number,
    isDark: boolean,
  ): HTMLCanvasElement {
    const tableCanvas = this.graphics.repeat(bitmap, bounds, scale)
    const adjustedBounds: Dim = { w: tableCanvas.width, h: tableCanvas.height }
    const ratio = adjustedBounds.w / bounds.w
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

    const boardX = -bounds.x + boardPos.x
    const boardY = -bounds.y + boardPos.y

    // darken the place where the puzzle should be at the end a bit
    {
      const border = { w: 8, h: 8 }
      tableCtx.fillStyle = 'rgba(0, 0, 0, .5)'
      tableCtx.fillRect(
        ratio * (boardX - border.w),
        ratio * (boardY - border.h),
        ratio * (boardDim.w + 2 * border.w),
        ratio * border.h,
      )
      tableCtx.fillRect(
        ratio * (boardX - border.w),
        ratio * boardY,
        ratio * border.h,
        ratio * boardDim.h,
      )
      tableCtx.fillRect(
        ratio * (boardX + boardDim.w),
        ratio * (boardY),
        ratio * border.w,
        ratio * boardDim.h,
      )
      tableCtx.fillRect(
        ratio * (boardX - border.w),
        ratio * (boardY + boardDim.h),
        ratio * (boardDim.w + 2 * border.w),
        ratio * border.h,
      )
    }

    // draw the board
    {
      tableCtx.fillStyle = isDark ? 'rgba(0, 0, 0, .3)' : 'rgba(255, 255, 255, .3)'
      tableCtx.fillRect(
        ratio * boardX,
        ratio * boardY,
        ratio * boardDim.w,
        ratio * boardDim.h,
      )
    }

    return tableCanvas
  }
}
