'use strict'

import { colorEquals } from '../../common/src/Color'
import type { Color } from '../../common/src/Color'
import type { Rect } from './Geometry'
import type { Graphics } from './Graphics'

export class GraphicsOperations {
  private static IS_DARK_THRESHOLD = 175

  public supportsWebgl2Cache: boolean | null = null

  public constructor(
    private readonly gfx: Graphics,
  ) { }

  private createCanvas(width: number, height: number): HTMLCanvasElement {
    return this.gfx.createCanvas(width, height)
  }

  public toGrayscale(
    canvas: Exclude<CanvasImageSource, VideoFrame | SVGImageElement>,
    background: string,
    opacity: number,
  ): HTMLCanvasElement {
    const c = this.createCanvas(canvas.width, canvas.height)
    const ctx = c.getContext('2d')!
    ctx.drawImage(canvas, 0, 0)
    const imgData = ctx.getImageData(0, 0, c.width, c.height)
    const data = imgData.data
    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3
      data[i] = avg
      data[i + 1] = avg
      data[i + 2] = avg
    }
    ctx.putImageData(imgData, 0, 0)

    const c2 = this.createCanvas(canvas.width, canvas.height)
    const ctx2 = c2.getContext('2d')!
    ctx2.fillStyle = background
    ctx2.fillRect(0, 0, c2.width, c2.height)
    ctx2.save()
    ctx2.globalAlpha = opacity
    ctx2.drawImage(c, 0, 0, c2.width, c2.height)
    ctx2.restore()

    return c2
  }

  public resize(
    canvas: Exclude<CanvasImageSource, VideoFrame | SVGImageElement>,
    width: number,
    height: number,
  ): HTMLCanvasElement {
    const c = this.createCanvas(width, height)
    const ctx = c.getContext('2d')!
    ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, width, height)
    return c
  }

  public removeColor(
    canvas: Exclude<CanvasImageSource, VideoFrame | SVGImageElement>,
    colorToRemove: Color,
  ): HTMLCanvasElement {
    const c = this.createCanvas(canvas.width, canvas.height)
    const ctx = c.getContext('2d')!
    ctx.drawImage(canvas, 0, 0)
    const imageData = ctx.getImageData(0, 0, c.width, c.height)
    const pixels = imageData.data
    for (let i = 0; i < pixels.length; i += 4) {
      const color = pixels.slice(i, i + 4) as Color
      if (colorEquals(color, colorToRemove)) {
        // make the color transparent
        pixels[i + 3] = 0
      }
    }
    ctx.putImageData(imageData, 0, 0)
    return c
  }

  public extractColor(
    canvas: Exclude<CanvasImageSource, VideoFrame | SVGImageElement>,
    colorToExtract: Color,
  ): HTMLCanvasElement {
    const c = this.createCanvas(canvas.width, canvas.height)
    const ctx = c.getContext('2d')!
    ctx.drawImage(canvas, 0, 0)
    const imageData = ctx.getImageData(0, 0, c.width, c.height)
    const pixels = imageData.data
    for (let i = 0; i < pixels.length; i += 4) {
      const color = pixels.slice(i, i + 4) as Color
      if (!colorEquals(color, colorToExtract)) {
        // make the color transparent
        pixels[i + 3] = 0
      }
    }
    ctx.putImageData(imageData, 0, 0)
    return c
  }

  public colorize(
    canvas: Exclude<CanvasImageSource, VideoFrame | SVGImageElement>,
    maskCanvas: Exclude<CanvasImageSource, VideoFrame | SVGImageElement>,
    color: string,
  ): HTMLCanvasElement {
    if (color === 'ukraine') {
      // '#0057B7' // blue
      // '#FFDD00' // yellow

      const c1 = this.createCanvas(canvas.width, canvas.height)
      const ctx1 = c1.getContext('2d')!
      const blueH = maskCanvas.height / 1.75
      ctx1.save()
      ctx1.drawImage(maskCanvas, 0, 0)
      ctx1.fillStyle = '#0057B7'
      ctx1.globalCompositeOperation = 'source-in'
      ctx1.fillRect(0, 0, maskCanvas.width, blueH)
      ctx1.restore()
      ctx1.save()
      ctx1.globalCompositeOperation = 'source-over'
      ctx1.drawImage(canvas, 0, 0)
      ctx1.restore()

      const c2 = this.createCanvas(canvas.width, canvas.height / 2)
      const ctx2 = c2.getContext('2d')!
      ctx2.save()
      ctx2.drawImage(maskCanvas, 0, -blueH)
      ctx2.fillStyle = '#FFDD00'
      ctx2.globalCompositeOperation = 'source-in'
      ctx2.fillRect(0, 0, maskCanvas.width, maskCanvas.height)
      ctx2.restore()
      ctx2.save()
      ctx2.globalCompositeOperation = 'source-over'
      ctx2.drawImage(canvas, 0, -blueH)
      ctx2.restore()
      ctx1.drawImage(c2, 0, blueH)
      return c1
    }

    const c = this.createCanvas(canvas.width, canvas.height)
    const ctx = c.getContext('2d')!
    ctx.save()
    ctx.drawImage(maskCanvas, 0, 0)
    ctx.fillStyle = color
    ctx.globalCompositeOperation = 'source-in'
    ctx.fillRect(0, 0, maskCanvas.width, maskCanvas.height)
    ctx.restore()
    ctx.save()
    ctx.globalCompositeOperation = 'source-over'
    ctx.drawImage(canvas, 0, 0)
    ctx.restore()
    return c
  }

  public repeat(
    canvas: Exclude<CanvasImageSource, VideoFrame | SVGImageElement>,
    rect: Rect,
    scale: number,
  ): HTMLCanvasElement {
    // fix for firefox not rendering something on canvases that are too big
    const max = 10240
    let w, h
    if (rect.w > rect.h) {
      w = Math.min(rect.w, max)
      h = w * rect.h / rect.w
    } else {
      h = Math.min(rect.h, max)
      w = h * rect.w / rect.h
    }

    // adjusted ratio of bitmap drawn, in case canvas was bigger than
    // the max canvas size
    const hratio = rect.h > max ? max / rect.h : 1
    const wratio = rect.w > max ? max / rect.w : 1

    const c = this.createCanvas(w, h)
    const bmw = Math.round(Math.max(canvas.width * wratio * scale, 100))
    const bmh = Math.round(Math.max(canvas.height * hratio * scale, 100))
    const ctx = c.getContext('2d')!
    for (let x = 0; x < c.width; x += bmw) {
      for (let y = 0; y < c.height; y += bmh) {
        ctx.drawImage(canvas, x, y, bmw, bmh)
      }
    }
    return c
  }

  public getBrightness(
    canvas: HTMLCanvasElement,
  ): number {
    const ctx = canvas.getContext('2d')!
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data
    let r, g, b, avg
    let colorSum = 0
    for (let x = 0, len = data.length; x < len; x += 4) {
      r = data[x]
      g = data[x + 1]
      b = data[x + 2]
      avg = Math.floor((r + g + b) / 3)
      colorSum += avg
    }
    return Math.floor(colorSum / (canvas.width * canvas.height))
  }

  public isDark(
    canvas: HTMLCanvasElement,
  ): boolean {
    return this.getBrightness(canvas) < GraphicsOperations.IS_DARK_THRESHOLD
  }
}
