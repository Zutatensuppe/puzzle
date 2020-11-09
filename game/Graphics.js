import Bitmap from './Bitmap.js'

function copyUint8ClampedArray(src) {
  const arr = new Uint8ClampedArray(src.length)
  arr.set(new Uint8ClampedArray(src));
  return arr
}

function createCanvas(width = 0, height = 0) {
    const c = document.createElement('canvas')
    c.width = width === 0 ? window.innerWidth : width
    c.height = height === 0 ? window.innerHeight : height
    return c
}

function dataToBitmap(w, h, data) {
  const bitmap = new Bitmap(w, h)
  bitmap._data = copyUint8ClampedArray(data)
  return bitmap
}

function canvasToBitmap(
  /** @type {HTMLCanvasElement} */ c,
  /** @type {CanvasRenderingContext2D} */ ctx
) {
  const data = ctx.getImageData(0, 0, c.width, c.height).data
  return dataToBitmap(c.width, c.height, data)
}

function imageToBitmap(img) {
  const c = createCanvas(img.width, img.height)
  const ctx = c.getContext('2d')
  ctx.drawImage(img, 0, 0)
  return canvasToBitmap(c, ctx)
}

async function loadImageToBitmap(imagePath) {
  const img = new Image()
  await new Promise((resolve) => {
    img.onload = resolve
    img.src = imagePath
  });
  return imageToBitmap(img)
}

function resizeBitmap (bitmap, width, height) {
  const tmp = new Bitmap(width, height)
  mapBitmapToBitmap(
    bitmap,
    bitmap.getBoundingRect(),
    tmp,
    tmp.getBoundingRect()
  )
  return tmp
}

function mapBitmapToBitmap(
  /** @type {Bitmap} */src,
  /** @type {BoundingRectangle} */ rect_src,
  /** @type {Bitmap} */ dst,
  /** @type {BoundingRectangle} */ rect_dst
) {
  const tmp = new Uint8ClampedArray(4)
  const w_f = rect_src.width / rect_dst.width
  const h_f = rect_src.height / rect_dst.height

  const startX = Math.max(rect_dst.x0, Math.floor((-rect_src.x0 / w_f) + rect_dst.x0))
  const startY = Math.max(rect_dst.y0, Math.floor((-rect_src.y0 / h_f) + rect_dst.y0))

  const endX = Math.min(rect_dst.x1, Math.ceil(((src.width - rect_src.x0) / w_f) + rect_dst.x0))
  const endY = Math.min(rect_dst.y1, Math.ceil(((src.height - rect_src.y0) / h_f) + rect_dst.y0))

  for (let x = startX; x < endX; x++) {
    for (let y = startY; y < endY; y++) {
      const src_x = rect_src.x0 + Math.floor((x - rect_dst.x0) * w_f)
      const src_y = rect_src.y0 + Math.floor((y - rect_dst.y0) * h_f)
      if (src.getPix(src_x, src_y, tmp)) {
        if (tmp[3] === 255) {
          dst.putPix(x, y, tmp)
        }
      }
    }
  }
}

function mapBitmapToBitmapCapped(
  /** @type {Bitmap} */ src,
  /** @type {BoundingRectangle} */ rect_src,
  /** @type {Bitmap} */ dst,
  /** @type {BoundingRectangle} */ rect_dst,
  rects_cap
) {
  if (!rects_cap) {
    return mapBitmapToBitmap(src, rect_src, dst, rect_dst)
  }
  const tmp = new Uint8ClampedArray(4)
  const w_f = rect_src.width / rect_dst.width
  const h_f = rect_src.height / rect_dst.height

  for (let rect_cap of rects_cap) {
    const startX = Math.floor(Math.max(rect_cap.x0, rect_dst.x0, (-rect_src.x0 / w_f) + rect_dst.x0))
    const startY = Math.floor(Math.max(rect_cap.y0, rect_dst.y0, (-rect_src.y0 / h_f) + rect_dst.y0))

    const endX = Math.ceil(Math.min(rect_cap.x1, rect_dst.x1, ((src.width - rect_src.x0) / w_f) + rect_dst.x0))
    const endY = Math.ceil(Math.min(rect_cap.y1, rect_dst.y1, ((src.height - rect_src.y0) / h_f) + rect_dst.y0))

    for (let x = startX; x < endX; x++) {
      for (let y = startY; y < endY; y++) {
        const src_x = rect_src.x0 + Math.floor((x - rect_dst.x0) * w_f)
        const src_y = rect_src.y0 + Math.floor((y - rect_dst.y0) * h_f)
        if (src.getPix(src_x, src_y, tmp)) {
          if (tmp[3] === 255) {
            dst.putPix(x, y, tmp)
          }
        }
      }
    }
  }
}

function fillBitmap (bitmap, rgba) {
  const len = bitmap.width * bitmap.height * 4
  bitmap._data = new Uint8ClampedArray(len)
  for (let i = 0; i < len; i+=4) {
      bitmap._data[i] = rgba[0]
      bitmap._data[i + 1] = rgba[1]
      bitmap._data[i + 2] = rgba[2]
      bitmap._data[i + 3] = rgba[3]
  }
}

function fillBitmapCapped(bitmap, rgba, rects_cap) {
  if (!rects_cap) {
    return fillBitmap(bitmap, rgba)
  }
  for (let rect_cap of rects_cap) {
    let startX = Math.floor(rect_cap.x0)
    let startY = Math.floor(rect_cap.y0)

    let endX = Math.ceil(rect_cap.x1)
    let endY = Math.ceil(rect_cap.y1)

    for (let x = startX; x < endX; x++) {
      for (let y = startY; y < endY; y++) {
        bitmap.putPix(x, y, rgba)
      }
    }
  }
}

function mapBitmapToAdapterCapped (
  /** @type {Bitmap} */ src,
  /** @type {BoundingRectangle} */ rect_src,
  /** @type {CanvasAdapter} */ dst,
  /** @type {BoundingRectangle} */ rect_dst,
  rects_cap
) {
  if (!rects_cap) {
    return mapBitmapToAdapter(src, rect_src, dst, rect_dst)
  }
  const tmp = new Uint8ClampedArray(4)
  const w_f = rect_src.width / rect_dst.width
  const h_f = rect_src.height / rect_dst.height

  for (let rect_cap of rects_cap) {
    let startX = Math.floor(Math.max(rect_cap.x0, rect_dst.x0, (-rect_src.x0 / w_f) + rect_dst.x0))
    let startY = Math.floor(Math.max(rect_cap.y0, rect_dst.y0, (-rect_src.y0 / h_f) + rect_dst.y0))

    let endX = Math.ceil(Math.min(rect_cap.x1, rect_dst.x1, ((src.width - rect_src.x0) / w_f) + rect_dst.x0))
    let endY = Math.ceil(Math.min(rect_cap.y1, rect_dst.y1, ((src.height - rect_src.y0) / h_f) + rect_dst.y0))

    for (let x = startX; x < endX; x++) {
      for (let y = startY; y < endY; y++) {
        const src_x = rect_src.x0 + Math.floor((x - rect_dst.x0) * w_f)
        const src_y = rect_src.y0 + Math.floor((y - rect_dst.y0) * h_f)
        if (src.getPix(src_x, src_y, tmp)) {
          if (tmp[3] === 255) {
            dst.putPix(x, y, tmp)
          }
        }
      }
    }
  }
}

function mapBitmapToAdapter(
  /** @type {Bitmap} */ src,
  /** @type {BoundingRectangle} */ rect_src,
  /** @type {CanvasAdapter} */ dst,
  /** @type {BoundingRectangle} */ rect_dst
) {
  const tmp = new Uint8ClampedArray(4)
  const w_f = rect_src.width / rect_dst.width
  const h_f = rect_src.height / rect_dst.height

  let startX = Math.max(rect_dst.x0, Math.floor((-rect_src.x0 / w_f) + rect_dst.x0))
  let startY = Math.max(rect_dst.y0, Math.floor((-rect_src.y0 / h_f) + rect_dst.y0))

  let endX = Math.min(rect_dst.x1, Math.ceil(((src.width - rect_src.x0) / w_f) + rect_dst.x0))
  let endY = Math.min(rect_dst.y1, Math.ceil(((src.height - rect_src.y0) / h_f) + rect_dst.y0))

  for (let x = startX; x < endX; x++) {
    for (let y = startY; y < endY; y++) {
      const src_x = rect_src.x0 + Math.floor((x - rect_dst.x0) * w_f)
      const src_y = rect_src.y0 + Math.floor((y - rect_dst.y0) * h_f)
      if (src.getPix(src_x, src_y, tmp)) {
        if (tmp[3] === 255) {
          dst.putPix(x, y, tmp)
        }
      }
    }
  }
}

function drawBitmap(adapter, bitmap, pos) {
  const rect = bitmap.getBoundingRect()
  mapBitmapToAdapter(
    bitmap,
    rect,
    adapter,
    rect.moved(pos.x, pos.y)
  )
}

export default {
  createCanvas,
  dataToBitmap,
  canvasToBitmap,
  imageToBitmap,
  loadImageToBitmap,
  resizeBitmap,
  mapBitmapToBitmap,
  mapBitmapToBitmapCapped,
  fillBitmap,
  fillBitmapCapped,
  mapBitmapToAdapter,
  mapBitmapToAdapterCapped,
  drawBitmap,
}
