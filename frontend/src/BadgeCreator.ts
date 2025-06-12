import type { Assets } from './Assets'
import type { Graphics } from './Graphics'

const badgeMap: Record<string, string> = {}
export const getColoredBadge = (graphics: Graphics, assets: Assets, color: string, active: boolean): string => {
  const key = 'color_' + color + '_' + (active ? 'active' : 'idle')
  if (!(key in badgeMap)) {
    const bmp = active ? assets.Gfx.badgeOver : assets.Gfx.badgeOverIdle
    badgeMap[key] = graphics.colorizedCanvas(bmp, assets.Gfx.badgeMask, color || '#ffffff').toDataURL()
  }
  return badgeMap[key]
}

export const getAnonBadge = (graphics: Graphics, assets: Assets, active: boolean): string => {
  const key = 'anon_' + (active ? 'active' : 'idle')
  if (!(key in badgeMap)) {
    const bmp = active ? assets.Gfx.badgeAnon : assets.Gfx.badgeAnonIdle
    badgeMap[key] = graphics.bitmapToImageString(bmp)
  }
  return badgeMap[key]
}
