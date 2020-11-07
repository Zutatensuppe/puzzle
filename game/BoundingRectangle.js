import Point from './Point.js'

export default class BoundingRectangle {
    constructor(x0, x1, y0, y1) {
        this.x0 = x0
        this.x1 = x1
        this.y0 = y0
        this.y1 = y1
        this.width = (x1 - x0) + 1
        this.height = (y1 - y0) + 1
    }

    div(d) {
        this.x0 /= d
        this.x1 /= d
        this.y0 /= d
        this.y1 /= d
    }
    
    move(x, y) {
        this.x0 += x
        this.x1 += x
        this.y0 += y
        this.y1 += y
    }
    
    moved(x, y) {
        return new BoundingRectangle(
            this.x0 + x,
            this.x1 + x,
            this.y0 + y,
            this.y1 + y
        )
    }

    center() {
        return new Point(
            this.x0 + this.width / 2,
            this.y0 + this.height / 2,
        )
    }
    
    centerDistance(other) {
        return this.center().distance(other.center())
    }
}