import BoundingRectangle from './BoundingRectangle.js'

export default class CanvasAdapter {
  constructor(canvas) {
    this._canvas = canvas
    this._ctx = this._canvas.getContext('2d')
    this._w = this._canvas.width
    this._h = this._canvas.height
    this._boundingRect = new BoundingRectangle(0, this._w - 1, 0, this._h - 1)

    this._imageData = this._ctx.createImageData(this._w, this._h)
    this._data = this._imageData.data

    this.width = this._w
    this.height = this._h
  }

  clear() {
    this._imageData = this._ctx.createImageData(this._w, this._h)
    this._data = this._imageData.data
    this.apply()
  }
  clearRect(rect) {
    for (let x = rect.x0; x< rect.x1; x++) {
      for (let y = rect.y0; y< rect.y1; y++) {
        this.putPix(x, y, [0,0,0,0])
      }
    }
    this.apply()
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
  }

  getBoundingRect() {
    return this._boundingRect
  }

  apply() {
    this._ctx.putImageData(this._imageData, 0, 0)
  }
}
