import GameCommon from '@common/GameCommon'
import type { Dim, Point, Rect } from '@common/Geometry'
import type { GameId, PlayerSettingsData } from '@common/Types'
import { logger } from '@common/Util'
import type { Graphics } from './Graphics'
import { getTextureInfoByPlayerSettings } from './PuzzleTableTextureInfo'

const log = logger('PuzzleTable.ts')

const cache: Record<string, HTMLCanvasElement | null> = {}

export class PuzzleTable {
  private lastWorkingCacheKey: string | null = null

  constructor(
    private readonly graphics: Graphics,
  ) { }

  public async loadTextureToCanvas(
    gameId: GameId,
    settings: PlayerSettingsData,
  ): Promise<HTMLCanvasElement | null> {
    const textureInfo = getTextureInfoByPlayerSettings(settings)
    if (!textureInfo) {
      return null
    }
    const cacheKey = `${gameId}___${textureInfo.url}___${textureInfo.scale}___${settings.showPuzzleBackground}`
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

    try {
      const canvas = await this.graphics.loader.canvasFromSrc(textureInfo.url)
      const texture = this._createTableGfx(
        bounds,
        boardPos,
        boardDim,
        canvas,
        textureInfo.scale,
        this.graphics.op.isDark(canvas),
        settings.showPuzzleBackground,
      )
      cache[cacheKey] = texture
      return cache[cacheKey]
    } catch (e) {
      log.error('unable to load', textureInfo.url)
      log.error(e)
      return null
    }
  }

  public getImage(
    gameId: GameId,
    settings: PlayerSettingsData,
  ): HTMLCanvasElement | null {
    const textureInfo = getTextureInfoByPlayerSettings(settings)
    if (!textureInfo) {
      return null
    }
    const cacheKey = `${gameId}___${textureInfo.url}___${textureInfo.scale}___${settings.showPuzzleBackground}`
    if (cache[cacheKey]) {
      this.lastWorkingCacheKey = cacheKey
      return cache[cacheKey]
    }

    if (this.lastWorkingCacheKey && cache[this.lastWorkingCacheKey]) {
      // prevent flickering by returning the last working cache entry
      return cache[this.lastWorkingCacheKey]
    }

    return null
  }

  private _createTableGfx(
    bounds: Rect,
    boardPos: Point,
    boardDim: Dim,
    canvas: HTMLCanvasElement,
    scale: number,
    isDark: boolean,
    showPuzzleBackground: boolean,
  ): HTMLCanvasElement {
    const tableCanvas = this.graphics.op.repeat(canvas, bounds, scale)
    const adjustedBounds: Dim = { w: tableCanvas.width, h: tableCanvas.height }
    const ratio = adjustedBounds.w / bounds.w
    const tableCtx = tableCanvas.getContext('2d')!

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
    if (showPuzzleBackground) {
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
