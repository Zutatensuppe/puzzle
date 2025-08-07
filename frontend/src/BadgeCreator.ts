import type { Assets } from './Assets'
import type { Graphics } from './Graphics'
import type { ImageDataURL } from './Types'

const badgeMap: Record<string, ImageDataURL> = {}
export const getColoredBadge = (graphics: Graphics, assets: Assets, color: string, active: boolean): string => {
  const key = 'color_' + color + '_' + (active ? 'active' : 'idle')
  if (!(key in badgeMap)) {
    const bmp = active ? assets.Gfx.badgeOver : assets.Gfx.badgeOverIdle
    badgeMap[key] = graphics.op.colorize(bmp, assets.Gfx.badgeMask, color || '#ffffff').toDataURL() as ImageDataURL
  }
  return badgeMap[key]
}

export const getAnonBadge = (assets: Assets, active: boolean): string => {
  return active ? assets.Gfx.badgeAnon : assets.Gfx.badgeAnonIdle
}
