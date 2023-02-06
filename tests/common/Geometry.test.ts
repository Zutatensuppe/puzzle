import Geometry from "../../src/common/Geometry"
import { describe, expect, it } from 'vitest'

describe('Geometry.ts', () => {
  [
    { a: { x: 0, y: 0 }, b: { x: 10, y: 10 }, expected: { x: -10, y: -10 } },
  ].forEach(({ a, b, expected }) => it('pointSub $a - $b', () => {
    expect(Geometry.pointSub(a, b)).toStrictEqual(expected)
  }))

  ;[
    { a: { x: 0, y: 0 }, b: { x: 10, y: 10 }, expected: { x: 10, y: 10 } },
  ].forEach(({ a, b, expected }) => it('pointAdd $a + $b', () => {
    expect(Geometry.pointAdd(a, b)).toStrictEqual(expected)
  }))

  ;[
    { a: { x: 5, y: 5 }, b: { x: 10, y: 10 }, expected: 7.0710678118654755 },
  ].forEach(({ a, b, expected }) => it('pointDistance $a -> $b', () => {
    expect(Geometry.pointDistance(a, b)).toBe(expected)
  }))

  ;[
    { p: { x: 5, y: 5 }, rect: { x: 0, y: 0, w: 5, h: 5 }, expected: true },
    { p: { x: 5, y: 5 }, rect: { x: -1, y: -1, w: 5, h: 5 }, expected: false },
    { p: { x: 5, y: 5 }, rect: { x: -1, y: -1, w: 10, h: 10 }, expected: true },
  ].forEach(({ p, rect, expected }) => it('pointInBounds $p in $rect', () => {
    expect(Geometry.pointInBounds(p, rect)).toBe(expected)
  }))

  ;[
    { rect: { x: 0, y: 0, w: 5, h: 5 }, expected: { x: 2.5, y: 2.5 } },
    { rect: { x: -1, y: -1, w: 5, h: 5 }, expected: { x: 1.5, y: 1.5} },
    { rect: { x: -1, y: -1, w: 10, h: 10 }, expected: { x: 4, y: 4 } },
  ].forEach(({ rect, expected }) => it('rectCenter $rect', () => {
    expect(Geometry.rectCenter(rect)).toStrictEqual(expected)
  }))

  ;[
    { rect: { x: 0, y: 0, w: 5, h: 5 }, x: 5, y: -1, expected: { x: 5, y: -1, w: 5, h: 5 } },
  ].forEach(({ rect, x, y, expected }) => it('rectMoved $rect ($x, $y)', () => {
    expect(Geometry.rectMoved(rect, x, y)).toStrictEqual(expected)
  }))

  ;[
    { a: { x: 0, y: 0, w: 5, h: 5 }, b: { x: -1, y: -1, w: 10, h: 10 }, expected: 2.1213203435596424 },
    { a: { x: -5, y: -5, w: 10, h: 10 }, b: { x: -1, y: -1, w: 2, h: 2 }, expected: 0 },
  ].forEach(({a, b, expected}) => it('rectCenterDistance $a -> $b', () => {
    expect(Geometry.rectCenterDistance(a, b)).toBe(expected)
  }))

  ;[
    { a: { x: 0, y: 0, w: 5, h: 5 }, b: { x: -5, y: -5, w: 4.9, h: 4.9 }, expected: false },
    { a: { x: 0, y: 0, w: 5, h: 5 }, b: { x: -5, y: -5, w: 5, h: 5 }, expected: true },
    { a: { x: 0, y: 0, w: 5, h: 5 }, b: { x: -5, y: -5, w: 6, h: 6 }, expected: true },
  ].forEach(({a, b, expected}) => it('rectsOverlap $a x $b', () => {
    expect(Geometry.rectsOverlap(a, b)).toBe(expected)
  }))
})
