import { describe, expect, it } from 'vitest'
import { EncodedPieceShape, PieceRotation, PieceShape } from './Types'
import Util from './Util'

describe('Util.ts', () => {
  describe('de/encodeShape', () => {
    const testCases: {
      name: string
      decoded: PieceShape
      encoded: EncodedPieceShape
    }[] = [
      {
        name: 'flat on all sides',
        decoded: { top: 0, right: 0, bottom: 0, left: 0 },
        encoded: 0b01010101,
      },
      {
        name: 'taps on top and right, notches on bottom and left',
        decoded: { top: 1, right: 1, bottom: -1, left: -1 },
        encoded: 0b00001010,
      },
    ]

    testCases.forEach(({ name, decoded, encoded }) => it(name, () => {
      expect(Util.decodeShape(encoded)).toEqual(decoded)
      expect(Util.encodeShape(decoded)).toEqual(encoded)
    }))
  })

  describe('rotateShape', () => {
    const testCases: {
      name: string
      shape: PieceShape
      rotation: PieceRotation
      expected: PieceShape
    }[] = [
      {
        name: 'rot 90 degree, flat on all sides',
        shape: { top: 0, right: 0, bottom: 0, left: 0 },
        rotation: PieceRotation.R90,
        expected: { top: 0, right: 0, bottom: 0, left: 0 },
      },
      {
        name: 'rot 90 degree, taps on top and right, notches on bottom and left',
        shape: { top: 1, right: 1, bottom: -1, left: -1 },
        rotation: PieceRotation.R90,
        expected: { top: -1, right: 1, bottom: 1, left: -1 },
      },
      {
        name: 'rot 180 degree, taps on top and right, notches on bottom and left',
        shape: { top: 1, right: 1, bottom: -1, left: -1 },
        rotation: PieceRotation.R180,
        expected: { top: -1, right: -1, bottom: 1, left: 1 },
      },
      {
        name: 'rot 270 degree, taps on top and right, notches on bottom and left',
        shape: { top: 1, right: 1, bottom: -1, left: -1 },
        rotation: PieceRotation.R270,
        expected: { top: 1, right: -1, bottom: -1, left: 1 },
      },
    ]

    testCases.forEach(({ name, shape, rotation, expected }) => it(name, () => {
      const actual = Util.rotateShape(shape, rotation)
      expect(actual).toEqual(expected)
    }))
  })

  describe('rotateEncodedShape', () => {
    const testCases: {
      name: string
      shape: EncodedPieceShape
      rotation: PieceRotation
      expected: EncodedPieceShape
    }[] = [
      {
        name: 'rot 90 degree, flat on all sides',
        shape: 0b10101010,
        rotation: PieceRotation.R90,
        expected: 0b10101010,
      },
      {
        name: 'rot 90 degree, taps on top and right, notches on bottom and left',
        shape: 0b00001010,
        rotation: PieceRotation.R90,
        expected: 0b00101000,
      },
      {
        name: 'rot 180 degree, taps on top and right, notches on bottom and left',
        shape: 0b00001010,
        rotation: PieceRotation.R180,
        expected: 0b10100000,
      },
      {
        name: 'rot 270 degree, taps on top and right, notches on bottom and left',
        shape: 0b00001010,
        rotation: PieceRotation.R270,
        expected: 0b10000010,
      },
      {
        name: 'rot 90 degree, flat on top, taps on all other sides',
        shape: 0b10101000,
        rotation: PieceRotation.R90,
        expected: 0b10100010,
      },
    ]

    testCases.forEach(({ name, shape, rotation, expected }) => it(name, () => {
      const actual = Util.rotateEncodedShape(shape, rotation)
      expect(actual).toEqual(expected)
    }))
  })
})
