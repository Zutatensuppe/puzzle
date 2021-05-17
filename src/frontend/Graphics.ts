"use strict"

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

async function colorize(
  bitmap: ImageBitmap,
  mask: ImageBitmap,
  color: string
): Promise<ImageBitmap> {
  const c = createCanvas(bitmap.width, bitmap.height)
  const ctx = c.getContext('2d') as CanvasRenderingContext2D
  ctx.save()
  ctx.drawImage(mask, 0, 0)
  ctx.fillStyle = color
  ctx.globalCompositeOperation = "source-in"
  ctx.fillRect(0, 0, mask.width, mask.height)
  ctx.restore()
  ctx.save()
  ctx.globalCompositeOperation = "destination-over"
  ctx.drawImage(bitmap, 0, 0)
  ctx.restore()
  return await createImageBitmap(c)
}

export default {
  createCanvas,
  loadImageToBitmap,
  resizeBitmap,
  colorize,
}
