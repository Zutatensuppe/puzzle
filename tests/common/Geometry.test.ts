import Geometry from "../../src/common/Geometry"

describe('Geometry.ts', () => {
  test.each([
    { a: { x: 0, y: 0 }, b: { x: 10, y: 10 }, expected: { x: -10, y: -10 } },
  ])('pointSub $a - $b', ({ a, b, expected }) => {
    expect(Geometry.pointSub(a, b)).toStrictEqual(expected)
  })

  test.each([
    { a: { x: 0, y: 0 }, b: { x: 10, y: 10 }, expected: { x: 10, y: 10 } },
  ])('pointAdd $a + $b', ({ a, b, expected }) => {
    expect(Geometry.pointAdd(a, b)).toStrictEqual(expected)
  })

  test.each([
    { a: { x: 5, y: 5 }, b: { x: 10, y: 10 }, expected: 7.0710678118654755 },
  ])('pointDistance $a -> $b', ({ a, b, expected }) => {
    expect(Geometry.pointDistance(a, b)).toBe(expected)
  })

  test.each([
    { p: { x: 5, y: 5 }, rect: { x: 0, y: 0, w: 5, h: 5 }, expected: true },
    { p: { x: 5, y: 5 }, rect: { x: -1, y: -1, w: 5, h: 5 }, expected: false },
    { p: { x: 5, y: 5 }, rect: { x: -1, y: -1, w: 10, h: 10 }, expected: true },
  ])('pointInBounds $p in $rect', ({ p, rect, expected }) => {
    expect(Geometry.pointInBounds(p, rect)).toBe(expected)
  })

  test.each([
    { rect: { x: 0, y: 0, w: 5, h: 5 }, expected: { x: 2.5, y: 2.5 } },
    { rect: { x: -1, y: -1, w: 5, h: 5 }, expected: { x: 1.5, y: 1.5} },
    { rect: { x: -1, y: -1, w: 10, h: 10 }, expected: { x: 4, y: 4 } },
  ])('rectCenter $rect', ({ rect, expected }) => {
    expect(Geometry.rectCenter(rect)).toStrictEqual(expected)
  })

  test.each([
    { rect: { x: 0, y: 0, w: 5, h: 5 }, x: 5, y: -1, expected: { x: 5, y: -1, w: 5, h: 5 } },
  ])('rectMoved $rect ($x, $y)', ({ rect, x, y, expected }) => {
    expect(Geometry.rectMoved(rect, x, y)).toStrictEqual(expected)
  })

  test.each([
    { a: { x: 0, y: 0, w: 5, h: 5 }, b: { x: -1, y: -1, w: 10, h: 10 }, expected: 2.1213203435596424 },
    { a: { x: -5, y: -5, w: 10, h: 10 }, b: { x: -1, y: -1, w: 2, h: 2 }, expected: 0 },
  ])('rectCenterDistance $a -> $b', ({a, b, expected}) => {
    expect(Geometry.rectCenterDistance(a, b)).toBe(expected)
  })

  test.each([
    { a: { x: 0, y: 0, w: 5, h: 5 }, b: { x: -5, y: -5, w: 4.9, h: 4.9 }, expected: false },
    { a: { x: 0, y: 0, w: 5, h: 5 }, b: { x: -5, y: -5, w: 5, h: 5 }, expected: true },
    { a: { x: 0, y: 0, w: 5, h: 5 }, b: { x: -5, y: -5, w: 6, h: 6 }, expected: true },
  ])('rectsOverlap $a x $b', ({a, b, expected}) => {
    expect(Geometry.rectsOverlap(a, b)).toBe(expected)
  })
})
