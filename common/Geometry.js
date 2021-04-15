function pointSub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y }
}

function pointAdd(a, b) {
  return { x: a.x + b.x, y: a.y + b.y }
}

function pointDistance(a, b) {
  const diffX = a.x - b.x
  const diffY = a.y - b.y
  return Math.sqrt(diffX * diffX + diffY * diffY)
}

function pointInBounds(pt, rect) {
  return pt.x >= rect.x
    && pt.x <= rect.x + rect.w
    && pt.y >= rect.y
    && pt.y <= rect.y + rect.h
}

function rectCenter(rect) {
  return {
    x: rect.x + (rect.w / 2),
    y: rect.y + (rect.h / 2),
  }
}

function rectMoved(rect, x, y) {
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
function rectsOverlap(rectA, rectB) {
  return !(
    rectB.x > (rectA.x + rectA.w)
    || rectA.x > (rectB.x + rectB.w)
    || rectB.y > (rectA.y + rectA.h)
    || rectA.y > (rectB.y + rectB.h)
  )
}

function rectCenterDistance(rectA, rectB) {
  return pointDistance(rectCenter(rectA), rectCenter(rectB))
}

export default {
  pointSub,
  pointAdd,
  pointDistance,
  pointInBounds,
  rectCenter,
  rectMoved,
  rectCenterDistance,
  rectsOverlap,
}
