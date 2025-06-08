import type { Graphics } from './Graphics'
import { EncodedPlayerIdx } from '../../common/src/Types'
import type { EncodedPlayer } from '../../common/src/Types'

type PlayerNameCacheEntry = {
  text: string
  canvas: HTMLCanvasElement
  fontHeight: number
  actualHeight: number
}

const playerNameCache: Record<string, PlayerNameCacheEntry> = {}

export const getPlayerNameCanvas = (graphics: Graphics, p: EncodedPlayer): PlayerNameCacheEntry | null => {
  const w = 200
  const h = 20
  const text = `${p[EncodedPlayerIdx.NAME]} (${p[EncodedPlayerIdx.POINTS]})`
  if (!playerNameCache[p[EncodedPlayerIdx.ID]] || playerNameCache[p[EncodedPlayerIdx.ID]].text !== text) {
    const canvas = graphics.createCanvas(w, h)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = 'white'
    ctx.textAlign = 'center'
    ctx.fillText(text, canvas.width / 2, canvas.height / 2)
    const metrics = ctx.measureText(text)
    const fontHeight = metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent
    const actualHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent
    playerNameCache[p[EncodedPlayerIdx.ID]] = { text, canvas, fontHeight, actualHeight }
  }
  return playerNameCache[p[EncodedPlayerIdx.ID]]
}
