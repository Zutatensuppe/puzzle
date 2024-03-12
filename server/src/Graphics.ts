'use strict'

import fs from 'fs'
import { Rect } from './Geometry'
import { createCanvas as cCreateCanvas, Image, CanvasRenderingContext2D as cCanvasRenderingContext2D } from 'canvas'
import { GraphicsInterface } from './Types'

// @ts-ignore
import { polyfillPath2D } from 'path2d-polyfill'
import sharp from 'sharp'
import config from './Config'

// @ts-ignore
global.CanvasRenderingContext2D = cCanvasRenderingContext2D
polyfillPath2D(global)

export class Graphics implements GraphicsInterface {
  constructor(
    private readonly baseUrl: string,
  ) {
    // pass
  }
  createCanvas(width:number = 0, height:number = 0): HTMLCanvasElement {
    return cCreateCanvas(width, height) as unknown as HTMLCanvasElement
  }

  private async bufferToImageBitmap (buffer: ArrayBuffer): Promise<ImageBitmap> {
    const img = new Image()
    const buf = await sharp(buffer).jpeg().toBuffer()
    await new Promise<void>((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
      img.src = buf
    })
    return img as unknown as ImageBitmap
  }

  grayscaledCanvas(
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

  private async createImageBitmapFromBlob (blob: Blob): Promise<ImageBitmap> {
    const ab = await blob.arrayBuffer()
    const bitmap = await this.bufferToImageBitmap(ab)
    return bitmap
  }

  async loadImageToBitmap(imagePath: string): Promise<ImageBitmap> {
    imagePath = decodeURIComponent(imagePath)
    if (imagePath.startsWith('/image-service/')) {
      let url = this.baseUrl + imagePath
      url = url.includes('?') ? url + '&format=png' : url + '?format=png'
      const res = await fetch(url)
      const blob = await res.blob()
      const bitmap = await this.createImageBitmapFromBlob(blob)
      return bitmap
    }

    imagePath = imagePath.startsWith('/uploads/')
      ? config.dir.UPLOAD_DIR + imagePath.substring('/uploads'.length)
      : imagePath
    const buff = fs.readFileSync(imagePath)
    const blob = new Blob([buff])
    const bitmap = await this.createImageBitmapFromBlob(blob)
    return bitmap
  }

  bitmapToImageString(bitmap: ImageBitmap): string {
    const c = this.createCanvas(bitmap.width, bitmap.height)
    const ctx = c.getContext('2d') as CanvasRenderingContext2D
    ctx.drawImage(bitmap, 0, 0)
    return c.toDataURL()
  }

  resizeBitmap (
    bitmap: ImageBitmap,
    width: number,
    height: number,
  ): HTMLCanvasElement {
    const c = this.createCanvas(width, height)
    const ctx = c.getContext('2d') as CanvasRenderingContext2D
    ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height, 0, 0, width, height)
    return c
  }

  colorizedCanvas(
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
      ctx1.globalCompositeOperation = 'destination-over'
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
      ctx2.globalCompositeOperation = 'destination-over'
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
    ctx.globalCompositeOperation = 'destination-over'
    ctx.drawImage(bitmap, 0, 0)
    ctx.restore()
    return c
  }

  repeat(
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

    const c = this.createCanvas(w, h)
    const bmw = bitmap.width * scale
    const bmh = bitmap.height * scale
    const ctx = c.getContext('2d') as CanvasRenderingContext2D
    for (let x = 0; x < c.width; x+=bmw) {
      for (let y = 0; y < c.height; y+=bmh) {
        ctx.drawImage(bitmap, x, y, bmw, bmh)
      }
    }
    return c
  }
}
