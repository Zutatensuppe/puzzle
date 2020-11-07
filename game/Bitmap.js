import BoundingRectangle from './BoundingRectangle.js'

export default class Bitmap {
    constructor(width, height, rgba = null) {
        this._w = width
        this._h = height
        this._com = 4 // number of components per pixel (RGBA)
        this._boundingRect = new BoundingRectangle(0, this._w - 1, 0, this._h -1)
        const len = this._w * this._h * this._com
        this._data = new Uint8ClampedArray(len)
        if (rgba) {
            for (let i = 0; i < len; i+=4) {
                this._data[i] = rgba[0]
                this._data[i + 1] = rgba[1]
                this._data[i + 2] = rgba[2]
                this._data[i + 3] = rgba[3]
            }
        }

        // public
        this.width = this._w
        this.height = this._h
    }

    toImage() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = this._w;
        canvas.height = this._h;

        const imgData = ctx.createImageData(canvas.width, canvas.height);
        imgData.data.set(this._data);
        ctx.putImageData(imgData, 0, 0);


        return new Promise((resolve) => {

            const img = document.createElement('img')
            img.onload = () => {
                resolve(img)
            }
            img.src = canvas.toDataURL()
            return img
        })
    }
    
    getPix(x, y, out) {
        if (x < 0 ||  y < 0 || x >= this._w || y >= this._h) {
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
        if (x < 0 ||  y < 0 || x >= this._w || y >= this._h) {
            return;
        }
        x = Math.round(x)
        y = Math.round(y)
        const idx = (y * this._com * this._w) + (x * this._com)
        this._data[idx] = rgba[0]
        this._data[idx + 1] = rgba[1]
        this._data[idx + 2] = rgba[2]
        this._data[idx + 3] = rgba[3]
    }

    getBoundingRect() {
        return this._boundingRect
    }
}