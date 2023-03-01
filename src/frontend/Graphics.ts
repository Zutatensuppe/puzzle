'use strict'

import { Rect } from '../common/Geometry'

function createCanvas(width:number = 0, height:number = 0): HTMLCanvasElement {
    const c = document.createElement('canvas')
    c.width = width
    c.height = height
    return c
}

async function loadImageToBitmap(imagePath: string): Promise<ImageBitmap> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      createImageBitmap(img).then(resolve)
    }
    img.src = imagePath
  })
}

async function resizeBitmap (
  bitmap: ImageBitmap,
  width: number,
  height: number
): Promise<ImageBitmap> {
  const c = createCanvas(width, height)
  const ctx = c.getContext('2d') as CanvasRenderingContext2D
  ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height, 0, 0, width, height)
  return await createImageBitmap(c)
}

function colorizedCanvas(
  bitmap: ImageBitmap,
  mask: ImageBitmap,
  color: string,
): HTMLCanvasElement {
  if (color === 'ukraine') {
    // '#0057B7' // blue
    // '#FFDD00' // yellow

    const c1 = createCanvas(bitmap.width, bitmap.height)
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

    const c2 = createCanvas(bitmap.width, bitmap.height / 2)
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

  const c = createCanvas(bitmap.width, bitmap.height)
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

function repeat(
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

  const c = createCanvas(w, h)
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

export default {
  createCanvas,
  loadImageToBitmap,
  resizeBitmap,
  colorizedCanvas,
  repeat,
}
