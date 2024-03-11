'use strict'

import { Rect } from './Geometry'
import { GraphicsInterface } from '../../common/src/Types'

export class Graphics implements GraphicsInterface {
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

  createCanvas(width:number = 0, height:number = 0): HTMLCanvasElement {
      const c = document.createElement('canvas')
      c.width = width
      c.height = height
      return c
  }

  async loadImageToBitmap(imagePath: string): Promise<ImageBitmap> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        createImageBitmap(img).then(resolve)
      }
      img.onerror = (e) => {
        reject(e)
      }
      img.src = imagePath
    })
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

    // adjusted ratio of bitmap drawn, in case canvas was bigger than
    // the max canvas size
    const hratio = rect.h > max ? max / rect.h : 1
    const wratio = rect.w > max ? max / rect.w : 1

    const c = this.createCanvas(w, h)
    const bmw = Math.round(Math.max(bitmap.width * wratio * scale, 100))
    const bmh = Math.round(Math.max(bitmap.height * hratio * scale, 100))
    const ctx = c.getContext('2d') as CanvasRenderingContext2D
    for (let x = 0; x < c.width; x+=bmw) {
      for (let y = 0; y < c.height; y+=bmh) {
        ctx.drawImage(bitmap, x, y, bmw, bmh)
      }
    }
    return c
  }
}
