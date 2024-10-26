import { Dim, Point } from './Geometry'

let MIN_ZOOM = .1
const MAX_ZOOM = 6
const ZOOM_STEP = .05

type ZOOM_DIR = 'in' | 'out'

export interface Snapshot {
  x: number
  y: number
  curZoom: number
}

export class Camera {
  public x: number = 0
  public y: number = 0
  public curZoom: number = 1

  constructor(snapshot: Snapshot | null = null) {
    if (snapshot) {
      this.fromSnapshot(snapshot)
    }
  }

  calculateZoomCapping(windowDim: Dim, tableDim: Dim): void {
    // min zoom still may never go below .1
    MIN_ZOOM = Math.max(.1, windowDim.w / tableDim.w, windowDim.h / tableDim.h)
  }

  centerFit(
    canvasDim: Dim,
    tableDim: Dim,
    boardDim: Dim,
    border: number,
  ): void {
    this.reset()
    this.move(
      -(tableDim.w - canvasDim.w) / 2,
      -(tableDim.h - canvasDim.h) / 2,
    )

    // zoom viewport to fit whole puzzle in
    const x = this.worldDimToViewportRaw(boardDim)
    const targetW = canvasDim.w - (border * 2)
    const targetH = canvasDim.h - (border * 2)
    if (
      (x.w > targetW || x.h > targetH)
      || (x.w < targetW && x.h < targetH)
    ) {
      const zoom = Math.min(targetW / x.w, targetH / x.h)
      const center = { x: canvasDim.w / 2, y: canvasDim.h / 2 }
      this.setZoom(zoom, center)
    }
  }

  snapshot(): Snapshot {
    return { x: this.x, y: this.y, curZoom: this.curZoom }
  }

  getCurrentZoom() {
    return this.curZoom
  }

  fromSnapshot(snapshot: Snapshot) {
    this.x = snapshot.x
    this.y = snapshot.y
    this.curZoom = snapshot.curZoom
  }

  reset() {
    this.x = 0
    this.y = 0
    this.curZoom = 1
  }

  move(byX: number, byY: number) {
    this.x += byX / this.curZoom
    this.y += byY / this.curZoom
  }

  calculateNewZoom(inout: ZOOM_DIR): number {
    const factor = inout === 'in' ? 1 : -1
    const newzoom = this.curZoom + ZOOM_STEP * this.curZoom * factor
    const capped = Math.min(Math.max(newzoom, MIN_ZOOM), MAX_ZOOM)
    return capped
  }

  canZoom(inout: ZOOM_DIR): boolean {
    return this.curZoom != this.calculateNewZoom(inout)
  }

  setZoom(newzoom: number, viewportCoordCenter: Point): boolean {
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
  zoom(inout: ZOOM_DIR, viewportCoordCenter: Point): boolean {
    return this.setZoom(this.calculateNewZoom(inout), viewportCoordCenter)
  }

  /**
   * Translate a coordinate in the viewport to a
   * coordinate in the world, rounded
   * @param {x, y} viewportCoord
   */
  viewportToWorld(viewportCoord: Point): Point {
    const { x, y } = this.viewportToWorldRaw(viewportCoord)
    return { x: Math.round(x), y: Math.round(y) }
  }

  /**
   * Translate a coordinate in the viewport to a
   * coordinate in the world, not rounded
   * @param {x, y} viewportCoord
   */
  viewportToWorldRaw(viewportCoord: Point): Point {
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
  worldToViewport(worldCoord: Point): Point {
    const { x, y } = this.worldToViewportRaw(worldCoord)
    return { x: Math.round(x), y: Math.round(y) }
  }

  /**
   * Translate a coordinate in the world to a
   * coordinate in the viewport, not rounded
   * @param {x, y} worldCoord
   */
  worldToViewportRaw(worldCoord: Point): Point {
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
  worldDimToViewport(worldDim: Dim): Dim {
    const { w, h } = this.worldDimToViewportRaw(worldDim)
    return { w: Math.round(w), h: Math.round(h) }
  }


  /**
   * Translate a 2d dimension (width/height) in the world to
   * one in the viewport, not rounded
   * @param {w, h} worldDim
   */
  worldDimToViewportRaw(worldDim: Dim): Dim {
    return {
      w: worldDim.w * this.curZoom,
      h: worldDim.h * this.curZoom,
    }
  }

  viewportDimToWorld(viewportDim: Dim): Dim {
    const { w, h } = this.viewportDimToWorldRaw(viewportDim)
    return { w: Math.round(w), h: Math.round(h) }
  }

  viewportDimToWorldRaw(viewportDim: Dim): Dim {
    return {
      w: viewportDim.w / this.curZoom,
      h: viewportDim.h / this.curZoom,
    }
  }
}
