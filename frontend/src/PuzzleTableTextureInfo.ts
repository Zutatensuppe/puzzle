import { PlayerSettingsData } from './Types'

export type PuzzleTableTextureInfo = { url: string, scale: number }

export const PuzzleTableTextureInfos: Record<string, PuzzleTableTextureInfo> = {
  dark: { url: '/assets/textures/wood-dark.jpg', scale: 1.5 },
  light: { url: '/assets/textures/wood-light.jpg', scale: 1.5 },
  brown: { url: '/assets/textures/Oak-none-3275x2565mm-Architextures.jpg', scale: 2.5 },
  aiwood: { url: '/assets/textures/ai-wood.png', scale: 1.5 },
}

export const getTextureInfo = (textureNameOrUrl: string, scale: number): PuzzleTableTextureInfo => {
  return textureNameOrUrl in PuzzleTableTextureInfos
    ? PuzzleTableTextureInfos[textureNameOrUrl]
    : { url: textureNameOrUrl, scale }
}

export const getTextureInfoByPlayerSettings = (settings: PlayerSettingsData): PuzzleTableTextureInfo | null => {
  const textureNameOrUrl = settings.useCustomTableTexture
    ? settings.customTableTexture
    : settings.tableTexture
  if (!textureNameOrUrl) {
    return null
  }
  const scale = settings.useCustomTableTexture
    ? settings.customTableTextureScale
    : 1 // determined later, but always fixed for cache key
  return getTextureInfo(textureNameOrUrl, scale)
}
