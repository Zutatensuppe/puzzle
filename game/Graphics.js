// import Bitmap from './Bitmap.js'

function createCanvas(width = 0, height = 0) {
    const c = document.createElement('canvas')
    c.width = width === 0 ? window.innerWidth : width
    c.height = height === 0 ? window.innerHeight : height
    return c
}

async function loadImageToBitmap(imagePath) {
  const img = new Image()
  await new Promise((resolve) => {
    img.onload = resolve
    img.src = imagePath
  });
  return await createImageBitmap(img, 0, 0, img.width, img.height)
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

export default {
  createBitmap,
  createCanvas,
  loadImageToBitmap,
  resizeBitmap,
}
