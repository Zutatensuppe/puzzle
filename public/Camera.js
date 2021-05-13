"use strict"

const MIN_ZOOM = .1
const MAX_ZOOM = 6
const ZOOM_STEP = .05

export default function Camera () {
  let x = 0
  let y = 0
  let curZoom = 1

  const move = (byX, byY) => {
    x += byX / curZoom
    y += byY / curZoom
  }

  const calculateNewZoom = (inout) => {
    const factor = inout === 'in' ? 1 : -1
    const newzoom = curZoom + ZOOM_STEP * curZoom * factor
    const capped = Math.min(Math.max(newzoom, MIN_ZOOM), MAX_ZOOM)
    return capped
  }

  const canZoom = (inout) => {
    return curZoom != calculateNewZoom(inout)
  }

  const setZoom = (newzoom, viewportCoordCenter) => {
    if (curZoom == newzoom) {
      return false
    }

    const zoomFactor = 1 - (curZoom / newzoom)
    move(
      -viewportCoordCenter.x * zoomFactor,
      -viewportCoordCenter.y * zoomFactor,
    )
    curZoom = newzoom
    return true
  }

  /**
   * Zooms towards/away from the provided coordinate, if possible.
   * If at max or min zoom respectively, no zooming is performed.
   */
  const zoom = (inout, viewportCoordCenter) => {
    return setZoom(calculateNewZoom(inout), viewportCoordCenter)
  }

  /**
   * Translate a coordinate in the viewport to a
   * coordinate in the world, rounded
   * @param {x, y} viewportCoord
   */
  const viewportToWorld = (viewportCoord) => {
    const { x, y } = viewportToWorldRaw(viewportCoord)
    return { x: Math.round(x), y: Math.round(y) }
  }

  /**
   * Translate a coordinate in the viewport to a
   * coordinate in the world, not rounded
   * @param {x, y} viewportCoord
   */
  const viewportToWorldRaw = (viewportCoord) => {
    return {
      x: (viewportCoord.x / curZoom) - x,
      y: (viewportCoord.y / curZoom) - y,
    }
  }

  /**
   * Translate a coordinate in the world to a
   * coordinate in the viewport, rounded
   * @param {x, y} worldCoord
   */
  const worldToViewport = (worldCoord) => {
    const { x, y } = worldToViewportRaw(worldCoord)
    return { x: Math.round(x), y: Math.round(y) }
  }

  /**
   * Translate a coordinate in the world to a
   * coordinate in the viewport, not rounded
   * @param {x, y} worldCoord
   */
  const worldToViewportRaw = (worldCoord) => {
    return {
      x: (worldCoord.x + x) * curZoom,
      y: (worldCoord.y + y) * curZoom,
    }
  }

  /**
   * Translate a 2d dimension (width/height) in the world to
   * one in the viewport, rounded
   * @param {w, h} worldDim
   */
  const worldDimToViewport = (worldDim) => {
    const { w, h } = worldDimToViewportRaw(worldDim)
    return { w: Math.round(w), h: Math.round(h) }
  }


  /**
   * Translate a 2d dimension (width/height) in the world to
   * one in the viewport, not rounded
   * @param {w, h} worldDim
   */
  const worldDimToViewportRaw = (worldDim) => {
    return {
      w: worldDim.w * curZoom,
      h: worldDim.h * curZoom,
    }
  }

  return {
    move,
    canZoom,
    zoom,
    worldToViewport,
    worldToViewportRaw,
    worldDimToViewport, // not used outside
    worldDimToViewportRaw,
    viewportToWorld,
    viewportToWorldRaw, // not used outside
  }
}
