import BoundingRectangle from './BoundingRectangle.js'

export default class CanvasAdapter {
  constructor(canvas) {
    this._canvas = canvas
    /** @type {CanvasRenderingContext2D} */
    this._ctx = this._canvas.getContext('2d')
    this._w = this._canvas.width
    this._h = this._canvas.height
    this._boundingRect = new BoundingRectangle(0, this._w - 1, 0, this._h - 1)

    this._imageData = this._ctx.createImageData(this._w, this._h)
    this._data = this._imageData.data

    this._dirty = false
    this._dirtyRect = {x0: 0, x1: 0, y0: 0, y1: 0}
    this.width = this._w
    this.height = this._h
  }

  clear() {
    this._imageData = this._ctx.createImageData(this._w, this._h)
    this._data = this._imageData.data
    this._dirty = false
  }
  clearRect(rects) {
    for (let rect of rects) {
      for (let x = rect.x0; x< rect.x1; x++) {
        for (let y = rect.y0; y< rect.y1; y++) {
          this.putPix(x, y, [0,0,0,0])
        }
      }
    }
  }

  getPix(x, y, out) {
    if (x < 0 || y < 0 || x >= this._w || y >= this._h) {
      return false;
    }
    x = Math.round(x)
    y = Math.round(y)
    const idx = (y * 4 * this._w) + (x * 4)
    out[0] = this._data[idx]
    out[1] = this._data[idx + 1]
    out[2] = this._data[idx + 2]
    out[3] = this._data[idx + 3]
    return true
  }

  putPix(x, y, rgba) {
    if (x < 0 || y < 0 || x >= this._w || y >= this._h) {
      return null;
    }

    x = Math.round(x)
    y = Math.round(y)
    const idx = (y * 4 * this._w) + (x * 4)
    this._data[idx] = rgba[0]
    this._data[idx + 1] = rgba[1]
    this._data[idx + 2] = rgba[2]
    this._data[idx + 3] = rgba[3]

    if (this._dirty) {
      // merge
      this._dirtyRect.x0 = Math.min(this._dirtyRect.x0, x)
      this._dirtyRect.x1 = Math.max(this._dirtyRect.x1, x)
      this._dirtyRect.y0 = Math.min(this._dirtyRect.y0, y)
      this._dirtyRect.y1 = Math.max(this._dirtyRect.y1, y)
    } else {
      // set
      this._dirty = true
      this._dirtyRect.x0 = x
      this._dirtyRect.x1 = x
      this._dirtyRect.y0 = y
      this._dirtyRect.y1 = y
    }
  }

  getBoundingRect() {
    return this._boundingRect
  }

  apply() {
    if (this._dirty) {
      this._ctx.putImageData(
        this._imageData,
        0,
        0,
        this._dirtyRect.x0,
        this._dirtyRect.y0,
        this._dirtyRect.x1 - this._dirtyRect.x0,
        this._dirtyRect.y1 - this._dirtyRect.y0
      )
      this._dirty = null
    } else {
      this._ctx.putImageData(this._imageData, 0, 0)
    }
  }
}
