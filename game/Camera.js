export default class Camera {
    constructor(canvas) {
        this.x = 0
        this.y = 0

        // TODO: when canvas resizes, this should
        //       syncronize with the cam
        this.width = canvas.width
        this.height = canvas.height

        this.zoom = 1
        this.minZoom = .1
        this.maxZoom = 6
        this.zoomStep = .05
    }

    rect() {
      return {
        x: -this.x,
        y: -this.y,
        w: this.width / this.zoom,
        h: this.height / this.zoom,
      }
    }

    move(x, y) {
        this.x += x / this.zoom
        this.y += y / this.zoom
    }

    setZoom(newzoom) {
      const zoom = Math.min(Math.max(newzoom, this.minZoom), this.maxZoom)
      if (zoom == this.zoom) {
        return false
      }

      // centered zoom
      // TODO: mouse-centered-zoom
      this.x -= Math.round(((this.width / this.zoom) - (this.width / zoom)) / 2)
      this.y -= Math.round(((this.height / this.zoom) - (this.height / zoom)) / 2)

      this.zoom = zoom
      return true
    }

    zoomOut() {
        return this.setZoom(this.zoom - this.zoomStep * this.zoom)
    }

    zoomIn() {
        return this.setZoom(this.zoom + this.zoomStep * this.zoom)
    }

    /**
     * Translate a coordinate in the viewport to a
     * coordinate in the world
     * @param {x, y} coord
     */
    viewportToWorld(coord) {
        return {
            x: Math.round((coord.x / this.zoom) - this.x),
            y: Math.round((coord.y / this.zoom) - this.y),
        }
    }

    /**
     * Translate a coordinate in the world to a
     * coordinate in the viewport
     * @param {x, y} coord
     */
    worldToViewport(coord) {
        return {
            x: Math.round((coord.x + this.x) * this.zoom),
            y: Math.round((coord.y + this.y) * this.zoom),
        }
    }

    worldDimToViewport(dim) {
        return {
            w: Math.round(dim.w * this.zoom),
            h: Math.round(dim.h * this.zoom),
        }
    }
}
