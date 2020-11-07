export default class Point {
    constructor(x,y) {
        this.x = x
        this.y = y
    }
    move(x, y) {
        this.x += x
        this.y += y
    }
    add(other) {
        return new Point(
            this.x + other.x,
            this.y + other.y
        )
    }
    sub(other) {
        return new Point(
            this.x - other.x,
            this.y - other.y
        )
    }
    distance(other) {
        const diffX = this.x - other.x
        const diffY = this.y - other.y
        return Math.sqrt(diffX * diffX + diffY * diffY)
    }
}
