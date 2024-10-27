import { PieceRotation } from './Types'

export interface Point {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}
export interface Dim {
  w: number
  h: number
}

function pointSub(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y }
}

function pointAdd(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y }
}

function pointDistance(a: Point, b: Point): number {
  const diffX = a.x - b.x
  const diffY = a.y - b.y
  return Math.sqrt(diffX * diffX + diffY * diffY)
}

function pointInBounds(pt: Point, rect: Rect): boolean {
  return pt.x >= rect.x
    && pt.x <= rect.x + rect.w
    && pt.y >= rect.y
    && pt.y <= rect.y + rect.h
}

function xyInBounds(x: number, y: number, rect: Rect): boolean {
  return x >= rect.x
    && x <= rect.x + rect.w
    && y >= rect.y
    && y <= rect.y + rect.h
}

function rectCenter(rect: Rect): Point {
  return {
    x: rect.x + (rect.w / 2),
    y: rect.y + (rect.h / 2),
  }
}

function pointRotate(pt: Point, rot: PieceRotation): Point {
  switch (rot) {
    case PieceRotation.R90:
      return { x: -pt.y, y: pt.x }
    case PieceRotation.R180:
      return { x: -pt.x, y: -pt.y }
    case PieceRotation.R270:
      return { x: pt.y, y: -pt.x }
    case PieceRotation.R0:
    default:
      return { x: pt.x, y: pt.y}
  }
}

/**
 * Returns a rectangle with same dimensions as the given one, but
 * location (x/y) moved by x and y.
 *
 * @param {x, y, w,, h} rect
 * @param number x
 * @param number y
 * @returns {x, y, w, h}
 */
function rectMoved(rect: Rect, x: number, y: number): Rect {
  return {
    x: rect.x + x,
    y: rect.y + y,
    w: rect.w,
    h: rect.h,
  }
}

/**
 * Returns true if the rectangles overlap, including their borders.
 *
 * @param {x, y, w, h} rectA
 * @param {x, y, w, h} rectB
 * @returns bool
 */
function rectsOverlap(rectA: Rect, rectB: Rect): boolean {
  return !(
    rectB.x > (rectA.x + rectA.w)
    || rectA.x > (rectB.x + rectB.w)
    || rectB.y > (rectA.y + rectA.h)
    || rectA.y > (rectB.y + rectB.h)
  )
}

function rectCenterDistance(rectA: Rect, rectB: Rect): number {
  return pointDistance(rectCenter(rectA), rectCenter(rectB))
}

export default {
  pointSub,
  pointAdd,
  pointDistance,
  pointInBounds,
  xyInBounds,
  pointRotate,
  rectCenter,
  rectMoved,
  rectCenterDistance,
  rectsOverlap,
}
