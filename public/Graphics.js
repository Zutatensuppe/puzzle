function createCanvas(width = 0, height = 0) {
    const c = document.createElement('canvas')
    c.width = width
    c.height = height
    return c
}

async function loadImageToBitmap(imagePath) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      createImageBitmap(img).then(resolve)
    }
    img.src = imagePath
  })
}

async function resizeBitmap (bitmap, width, height) {
  const c = createCanvas(width, height)
  const ctx = c.getContext('2d')
  ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height, 0, 0, width, height)
  return await createImageBitmap(c)
}

async function createBitmap(width, height, color) {
  const c = createCanvas(width, height)
  const ctx = c.getContext('2d')
  ctx.fillStyle = color
  ctx.fillRect(0, 0, width, height)
  return await createImageBitmap(c)
}

async function colorize(image, mask, color) {
  const c = createCanvas(image.width, image.height)
  const ctx = c.getContext('2d')
  ctx.save()
  ctx.drawImage(mask, 0, 0)
  ctx.fillStyle = color
  ctx.globalCompositeOperation = "source-in"
  ctx.fillRect(0, 0, mask.width, mask.height)
  ctx.restore()
  ctx.save()
  ctx.globalCompositeOperation = "destination-over"
  ctx.drawImage(image, 0, 0)
  ctx.restore()
  return await createImageBitmap(c)
}

export default {
  createBitmap,
  createCanvas,
  loadImageToBitmap,
  resizeBitmap,
  colorize,
}
