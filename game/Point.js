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
}
