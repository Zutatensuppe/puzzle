"use strict"

export default class Camera {
  constructor() {
    this.x = 0
    this.y = 0

    this.curZoom = 1
    this.minZoom = .1
    this.maxZoom = 6
    this.zoomStep = .05
  }

  move(x, y) {
    this.x += x / this.curZoom
    this.y += y / this.curZoom
  }

  canZoom(inout) {
    return this.curZoom != this.calculateNewZoom(inout)
  }

  calculateNewZoom(inout) {
    const factor = inout === 'in' ? 1 : -1
    const newzoom = this.curZoom + this.zoomStep * this.curZoom * factor
    const capped = Math.min(Math.max(newzoom, this.minZoom), this.maxZoom)
    return capped
  }

  setZoom(newzoom, viewportCoordCenter) {
    if (this.curZoom == newzoom) {
      return false
    }

    const zoomFactor = 1 - (this.curZoom / newzoom)
    this.move(
      -viewportCoordCenter.x * zoomFactor,
      -viewportCoordCenter.y * zoomFactor,
    )
    this.curZoom = newzoom
    return true
  }

  /**
   * Zooms towards/away from the provided coordinate, if possible.
   * If at max or min zoom respectively, no zooming is performed.
   */
  zoom(inout, viewportCoordCenter) {
    return this.setZoom(this.calculateNewZoom(inout), viewportCoordCenter)
  }

  /**
   * Translate a coordinate in the viewport to a
   * coordinate in the world, rounded
   * @param {x, y} viewportCoord
   */
  viewportToWorld(viewportCoord) {
    const worldCoord = this.viewportToWorldRaw(viewportCoord)
    return {
      x: Math.round(worldCoord.x),
      y: Math.round(worldCoord.y),
    }
  }

  /**
   * Translate a coordinate in the viewport to a
   * coordinate in the world, not rounded
   * @param {x, y} viewportCoord
   */
  viewportToWorldRaw(viewportCoord) {
    return {
      x: (viewportCoord.x / this.curZoom) - this.x,
      y: (viewportCoord.y / this.curZoom) - this.y,
    }
  }

  /**
   * Translate a coordinate in the world to a
   * coordinate in the viewport, rounded
   * @param {x, y} worldCoord
   */
  worldToViewport(worldCoord) {
    const viewportCoord = this.worldToViewportRaw(worldCoord)
    return {
      x: Math.round(viewportCoord.x),
      y: Math.round(viewportCoord.y),
    }
  }

  /**
   * Translate a coordinate in the world to a
   * coordinate in the viewport, not rounded
   * @param {x, y} worldCoord
   */
  worldToViewportRaw(worldCoord) {
    return {
      x: (worldCoord.x + this.x) * this.curZoom,
      y: (worldCoord.y + this.y) * this.curZoom,
    }
  }

  /**
   * Translate a 2d dimension (width/height) in the world to
   * one in the viewport, rounded
   * @param {w, h} worldDim
   */
  worldDimToViewport(worldDim) {
    const viewportDim = this.worldDimToViewportRaw(worldDim)
    return {
      w: Math.round(viewportDim.w),
      h: Math.round(viewportDim.h),
    }
  }


  /**
   * Translate a 2d dimension (width/height) in the world to
   * one in the viewport, not rounded
   * @param {w, h} worldDim
   */
  worldDimToViewportRaw(worldDim) {
    return {
      w: worldDim.w * this.curZoom,
      h: worldDim.h * this.curZoom,
    }
  }
}
