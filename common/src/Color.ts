import { Rng } from './Rng'

export type Color = [number, number, number, number] | Uint8ClampedArray | Uint8Array

export const COLOR_MAGENTA: Uint8Array = new Uint8Array([255, 0, 255, 255])
export const COLOR_BLUE: Uint8Array = new Uint8Array([0, 0, 255, 255])
export const COLOR_WHITE: Uint8Array = new Uint8Array([255, 255, 255, 255])

const hexToColorLookupMap = new Map<string, Color>()
export const hexToColor = (hex: string): Color => {
  if (!hexToColorLookupMap.has(hex)) {
    // probably needs some extra checks
    const c = hex.match(/\w\w/g)?.map(v => +(`0x${v}`) / 255.0)
    hexToColorLookupMap.set(hex, c ? [c[0], c[1], c[2], 255] : COLOR_WHITE)
  }
  return hexToColorLookupMap.get(hex)!
}

export const colorEquals = (a: Color, b: Color): boolean => {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3]
}

export const colorIsGrayscale = (color: Color): boolean => {
  return color[0] === color[1] && color[1] === color[2]
}

export function hueToRgb(h: number): [number, number, number] {
  const k = (n: number) => (n + h * 6) % 6
  const f = (n: number) => Math.max(0, Math.min(1, Math.abs(k(n) - 3) - 1))
  return [f(0), f(2), f(4)]
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16).padStart(2, '0')
    return hex
  }
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

export function rgbToHue(r: number, g: number, b: number): number {
  r = r / 255
  g = g / 255
  b = b / 255
  const min = Math.min(Math.min(r, g), b)
  const max = Math.max(Math.max(r, g), b)

  if (min == max) {
    return 0
  }

  let hue = 0.0
  if (max == r) {
    hue = (g - b) / (max - min)
  } else if (max == g) {
    hue = 2.0 + (b - r) / (max - min)
  } else {
    hue = 4.0 + (r - g) / (max - min)
  }
  hue = hue * 60
  if (hue < 0) {
    hue = hue + 360
  }

  return Math.round(hue) / 255
}

export function hueToHex(hue: number): string {
  const [r, g, b] = hueToRgb(hue)
  return rgbToHex(r, g, b)
}

export function rgbToRgba(r: number, g: number, b: number, alpha: number): string {
  // Convert r, g, b from 0-1 range to 0-255
  const to255 = (x: number) => Math.round(x * 255)
  return `rgba(${to255(r)}, ${to255(g)}, ${to255(b)}, ${alpha})`
}

export function hueToRgba(hue: number, alpha: number = 1): string {
  const [r, g, b] = hueToRgb(hue)
  return rgbToRgba(r, g, b, alpha)
}

export function randomColor(rng: Rng): [number, number, number] {
  const r = rng.random(0, 255)
  const g = rng.random(0, 255)
  const b = rng.random(0, 255)
  return [r, g, b]
}
