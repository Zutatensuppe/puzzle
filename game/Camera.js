import BoundingRectangle from "./BoundingRectangle.js"

export default class Camera {
    constructor(canvas) {
        this.x = 0
        this.y = 0

        // TODO: when canvas resizes, this should
        //       syncronize with the cam
        this.width = canvas.width
        this.height = canvas.height

        this.zoom = 1
        this.minZoom = .2
        this.maxZoom = 6
        this.zoomStep = .05
    }

    rect() {
      return new BoundingRectangle(
        - this.x,
        - this.x + (this.width / this.zoom),
        - this.y,
        - this.y + (this.height / this.zoom),
      )
    }

    move(x, y) {
        this.x += x / this.zoom
        this.y += y / this.zoom
    }

    zoomOut() {
        const newzoom = Math.max(this.zoom - this.zoomStep, this.minZoom)
        if (newzoom !== this.zoom) {
            // centered zoom
            this.x -= ((this.width / this.zoom) - (this.width / newzoom)) / 2
            this.y -= ((this.height / this.zoom) - (this.height / newzoom)) / 2

            this.zoom = newzoom
            return true
        }
        return false
    }

    zoomIn() {
        const newzoom = Math.min(this.zoom + this.zoomStep, this.maxZoom)
        if (newzoom !== this.zoom) {
            // centered zoom
            this.x -= ((this.width / this.zoom) - (this.width / newzoom)) / 2
            this.y -= ((this.height / this.zoom) - (this.height / newzoom)) / 2

            this.zoom = newzoom
            return true
        }
        return false
    }

    translateMouse(mouse) {
        return {
            x: (mouse.x / this.zoom) - this.x,
            y: (mouse.y / this.zoom) - this.y,
        }
    }

    translateMouseBack(mouse) {
        return {
            x: (mouse.x + this.x) * this.zoom,
            y: (mouse.y + this.y) * this.zoom,
        }
    }
}
