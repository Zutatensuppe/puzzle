'use strict'

import { Color, colorEquals } from '../../common/src/Color'
import { Rect } from './Geometry'

export class Graphics {
  private static instance: Graphics

  public static IS_DARK_THRESHOLD = 175

  public supportsWebgl2Cache: boolean | null = null

  private constructor() {
  }

  public static getInstance(): Graphics {
    if (!Graphics.instance) {
      Graphics.instance = new Graphics()
    }
    return Graphics.instance
  }

  public hasWebGL2Support(): boolean {
    if (this.supportsWebgl2Cache === null) {
      const canvas = this.createCanvas(1)
      this.supportsWebgl2Cache = !!canvas.getContext('webgl2')
    }
    return this.supportsWebgl2Cache
  }

  public grayscaledCanvas(
    bitmap: HTMLCanvasElement,
    background: string,
    opacity: number,
  ): HTMLCanvasElement {
    const c = this.createCanvas(bitmap.width, bitmap.height)
    const ctx = c.getContext('2d') as CanvasRenderingContext2D
    ctx.drawImage(bitmap, 0, 0)
    const imgData = ctx.getImageData(0, 0, c.width, c.height)
    const data = imgData.data
    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3
      data[i] = avg
      data[i + 1] = avg
      data[i + 2] = avg
    }
    ctx.putImageData(imgData, 0, 0)

    const c2 = this.createCanvas(bitmap.width, bitmap.height)
    const ctx2 = c2.getContext('2d') as CanvasRenderingContext2D
    ctx2.fillStyle = background
    ctx2.fillRect(0, 0, c2.width, c2.height)
    ctx2.save()
    ctx2.globalAlpha = opacity
    ctx2.drawImage(c, 0, 0, c2.width, c2.height)
    ctx2.restore()

    return c2
  }

  public imageElementToCanvas(imageElement: HTMLImageElement): HTMLCanvasElement {
    const canvas = this.createCanvas(imageElement.width, imageElement.height)
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
    ctx.drawImage(imageElement, 0, 0)
    return canvas
  }

  public createCanvas(width: number, height: number | null = null): HTMLCanvasElement {
    const c = document.createElement('canvas')
    c.width = width
    c.height = height === null ? width : height
    return c
  }

  public async loadImageToBitmap(src: string): Promise<ImageBitmap> {
    const img = await this.loadImageToImageElement(src)
    return await createImageBitmap(img)
  }

  public loadFileToBlob(file: File): Promise<Blob> {
    return new Promise<Blob>((resolve, reject) => {
      const r = new FileReader()
      r.readAsDataURL(file)
      r.onload = async (ev: any) => {
        try {
          const blob = await this.loadImageToBlob(ev.target.result)
          resolve(blob)
        } catch (e) {
          reject(e)
        }
      }
      r.onerror = (ev: any) => {
        reject(ev)
      }
    })
  }

  public dataUrlToBlob(dataUrl: string): Blob {
    const arr = dataUrl.split(',')
    const m = arr[0].match(/:(.*?);/)
    if (!m) {
      throw new Error('dataUrlToBlob: Could not parse data url')
    }
    const mime = m[1]
    const bstr = atob(arr[1])
    let n = bstr.length
    const u8arr = new Uint8Array(n)
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n)
    }
    return new Blob([u8arr], { type: mime })
  }

  public async loadImageToBlob(src: string): Promise<Blob> {
    const canvas = await this.loadImageToCanvas(src)
    return this.dataUrlToBlob(canvas.toDataURL())
  }

  public async loadImageToCanvas(src: string): Promise<HTMLCanvasElement> {
    const bitmap = await this.loadImageToImageElement(src)
    return this.imageElementToCanvas(bitmap)
  }

  public loadImageToImageElement(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        resolve(img)
      }
      img.onerror = (e) => {
        reject(e)
      }
      img.src = src
    })
  }

  public bitmapToImageString(bitmap: ImageBitmap): string {
    const c = this.createCanvas(bitmap.width, bitmap.height)
    const ctx = c.getContext('2d') as CanvasRenderingContext2D
    ctx.drawImage(bitmap, 0, 0)
    return c.toDataURL()
  }

  public resizeBitmap(
    bitmap: ImageBitmap,
    width: number,
    height: number,
  ): HTMLCanvasElement {
    const c = this.createCanvas(width, height)
    const ctx = c.getContext('2d') as CanvasRenderingContext2D
    ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height, 0, 0, width, height)
    return c
  }

  public async removeColor(imageBitmap: ImageBitmap, targetColor: Color) {
    const c = this.createCanvas(imageBitmap.width, imageBitmap.height)
    const ctx = c.getContext('2d')!
    ctx.drawImage(imageBitmap, 0, 0)
    const imageData = ctx.getImageData(0, 0, c.width, c.height)
    const pixels = imageData.data
    for (let i = 0; i < pixels.length; i += 4) {
      const color = pixels.slice(i, i + 4) as Color
      if (colorEquals(color, targetColor)) {
        // make the color transparent
        pixels[i + 3] = 0
      }
    }
    ctx.putImageData(imageData, 0, 0)
    return await createImageBitmap(c)
  }

  public async extractColor(imageBitmap: ImageBitmap, targetColor: Color) {
    const c = this.createCanvas(imageBitmap.width, imageBitmap.height)
    const ctx = c.getContext('2d')!
    ctx.drawImage(imageBitmap, 0, 0)
    const imageData = ctx.getImageData(0, 0, c.width, c.height)
    const pixels = imageData.data
    for (let i = 0; i < pixels.length; i += 4) {
      const color = pixels.slice(i, i + 4) as Color
      if (!colorEquals(color, targetColor)) {
        // make the color transparent
        pixels[i + 3] = 0
      }
    }
    ctx.putImageData(imageData, 0, 0)
    return await createImageBitmap(c)
  }

  public colorizedCanvas(
    bitmap: ImageBitmap,
    mask: ImageBitmap,
    color: string,
  ): HTMLCanvasElement {
    if (color === 'ukraine') {
      // '#0057B7' // blue
      // '#FFDD00' // yellow

      const c1 = this.createCanvas(bitmap.width, bitmap.height)
      const ctx1 = c1.getContext('2d') as CanvasRenderingContext2D
      const blueH = mask.height / 1.75
      ctx1.save()
      ctx1.drawImage(mask, 0, 0)
      ctx1.fillStyle = '#0057B7'
      ctx1.globalCompositeOperation = 'source-in'
      ctx1.fillRect(0, 0, mask.width, blueH)
      ctx1.restore()
      ctx1.save()
      ctx1.globalCompositeOperation = 'source-over'
      ctx1.drawImage(bitmap, 0, 0)
      ctx1.restore()

      const c2 = this.createCanvas(bitmap.width, bitmap.height / 2)
      const ctx2 = c2.getContext('2d') as CanvasRenderingContext2D
      ctx2.save()
      ctx2.drawImage(mask, 0, -blueH)
      ctx2.fillStyle = '#FFDD00'
      ctx2.globalCompositeOperation = 'source-in'
      ctx2.fillRect(0, 0, mask.width, mask.height)
      ctx2.restore()
      ctx2.save()
      ctx2.globalCompositeOperation = 'source-over'
      ctx2.drawImage(bitmap, 0, -blueH)
      ctx2.restore()
      ctx1.drawImage(c2, 0, blueH)
      return c1
    }

    const c = this.createCanvas(bitmap.width, bitmap.height)
    const ctx = c.getContext('2d') as CanvasRenderingContext2D
    ctx.save()
    ctx.drawImage(mask, 0, 0)
    ctx.fillStyle = color
    ctx.globalCompositeOperation = 'source-in'
    ctx.fillRect(0, 0, mask.width, mask.height)
    ctx.restore()
    ctx.save()
    ctx.globalCompositeOperation = 'source-over'
    ctx.drawImage(bitmap, 0, 0)
    ctx.restore()
    return c
  }

  public repeat(
    bitmap: ImageBitmap,
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
    const bmw = Math.round(Math.max(bitmap.width * wratio * scale, 100))
    const bmh = Math.round(Math.max(bitmap.height * hratio * scale, 100))
    const ctx = c.getContext('2d') as CanvasRenderingContext2D
    for (let x = 0; x < c.width; x += bmw) {
      for (let y = 0; y < c.height; y += bmh) {
        ctx.drawImage(bitmap, x, y, bmw, bmh)
      }
    }
    return c
  }

  public getBrightness(img: HTMLImageElement | ImageBitmap): number {
    const canvas = this.createCanvas(img.width, img.height)
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0)
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
    return Math.floor(colorSum / (img.width * img.height))
  }

  public isDark(img: HTMLImageElement | ImageBitmap): boolean {
    return this.getBrightness(img) < Graphics.IS_DARK_THRESHOLD
  }
}
