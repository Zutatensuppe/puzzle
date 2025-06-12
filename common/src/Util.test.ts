import { describe, expect, it } from 'vitest'
import { defaultImageInfo, PieceRotation } from './Types'
import type { EncodedGame, EncodedGameLegacy, EncodedPieceShape, Game, GameId, PieceShape, Puzzle, PuzzleInfo, UserId } from './Types'
import Util, { clamp } from './Util'

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


  describe('slug', () => {
    const testCases = [
      { str: '^%5k0sj55%%zxc0j', expected: '5k0sj55-zxc0j' },
    ]

    testCases.forEach(({ str, expected }) => it(`slug ${str}`, () => {
      expect(Util.slug(str)).toBe(expected)
    }))
  })

  describe('pad', () => {
    const testCases = [
      { x: 5, pad: '0000', expected: '0005' },
      { x: 5555, pad: '00', expected: '5555' },
    ]

    testCases.forEach(({ x, pad, expected }) => it(`pad ${x} ${pad}`, () => {
      expect(Util.pad(x, pad)).toBe(expected)
    }))
  })

  describe('de/encodeShape', () => {
    const testCases = [
      { shape: { top: -1, right: -1, bottom: -1, left: -1 }, encoded: 0b00000000 },
      { shape: { top: 1, right: -1, bottom: -1, left: -1 }, encoded: 0b00000010 },
      { shape: { top: 0, right: -1, bottom: -1, left: -1 }, encoded: 0b00000001 },
      { shape: { top: -1, right: -1, bottom: 1, left: -1 }, encoded: 0b00100000 },
      { shape: { top: -1, right: -1, bottom: 0, left: -1 }, encoded: 0b00010000 },
      { shape: { top: -1, right: -1, bottom: -1, left: 1 }, encoded: 0b10000000 },
      { shape: { top: -1, right: -1, bottom: -1, left: 0 }, encoded: 0b01000000 },
      { shape: { top: -1, right: 1, bottom: -1, left: -1 }, encoded: 0b00001000 },
      { shape: { top: -1, right: 0, bottom: -1, left: -1 }, encoded: 0b00000100 },
      { shape: { top: 1, right: 1, bottom: 1, left: 1 }, encoded: 0b10101010 },
    ]

    testCases.forEach(({ shape, encoded }) => it('encodeShape $shape', () => {
      expect(Util.encodeShape(shape)).toBe(encoded)
    }))

    testCases.forEach(({ shape, encoded }) => it('decodeShape $shape', () => {
      expect(Util.decodeShape(encoded)).toStrictEqual(shape)
    }))
  })

  describe('de/encodeGame', () => {
    const rng = {
      rand_high: 1,
      rand_low: 1,
      random: (_min: number, _max: number): number => 0,
      choice: <T>(array: T[]): T => array[0],
      shuffle: <T>(array: T[]): T[] => array,
    }

    const puzzleInfo: PuzzleInfo = {
      table: { width: 0, height: 0 },
      targetTiles: 0,
      width: 10,
      height: 10,
      tileSize: 5,
      tileDrawSize: 0,
      tileMarginWidth: 0,
      tileDrawOffset: 0,
      snapDistance: 0,
      tiles: 0,
      tilesX: 0,
      tilesY: 0,
      shapes: [],
      image: defaultImageInfo(),
    }
    const puzzle: Puzzle = {
      tiles: [],
      data: {
        started: 0,
        finished: 0,
        maxGroup: 0,
        maxZ: 0,
      },
      info: puzzleInfo,
    }

    const testCases = [
      {
        game: {
          id: 'id' as GameId,
          rng: { type: 'asd', obj: rng },
          puzzle: puzzle,
          players: [],
          scoreMode: 1,
          shapeMode: 1,
          snapMode: 1,
          rotationMode: 0,
          creatorUserId: 1 as UserId,
          hasReplay: true,
          gameVersion: 1,
          private: true,
          registeredMap: {},
          requireAccount: false,
          joinPassword: null,
          banned: {},
          showImagePreviewInBackground: false,
        } as Game,
        encoded: [
          'id' as GameId,
          'asd',
          { rand_high: 1, rand_low: 1 },
          puzzle,
          [],
          1,
          1,
          1,
          1 as UserId,
          true,
          1,
          true,
        ] as EncodedGameLegacy,
      },
      {
        game: {
          id: 'id' as GameId,
          rng: { type: 'asd', obj: rng },
          puzzle: puzzle,
          players: [],
          scoreMode: 1,
          shapeMode: 1,
          snapMode: 1,
          rotationMode: 1,
          creatorUserId: 1 as UserId,
          hasReplay: true,
          gameVersion: 1,
          private: true,
          crop: { x: 0, y: 0, w: 100, h: 100 },
          registeredMap: {},
          requireAccount: false,
          joinPassword: null,
          banned: {},
          showImagePreviewInBackground: false,
        } as Game,
        encoded: [
          'id' as GameId,
          'asd',
          { rand_high: 1, rand_low: 1 },
          puzzle,
          [],
          1,
          1,
          1,
          1 as UserId,
          true,
          1,
          true,
          { x: 0, y: 0, w: 100, h: 100 },
          {},
          1,
          null,
          false,
          {},
          false,
        ] as EncodedGame,
      },
    ]
    testCases.forEach(({ game, encoded }) => it('encodeGame $game', () => {
      expect(Util.encodeGame(game)).toStrictEqual(encoded)
    }))

    testCases.forEach(({ game, encoded }) => it('decodeGame $game', () => {
      const decoded = Util.decodeGame(encoded)
      // check relevant properties of rng object separately
      // because new object is never equal to original one
      expect(decoded.rng.obj.rand_high).toBe(encoded[2].rand_high)
      expect(decoded.rng.obj.rand_low).toBe(encoded[2].rand_low)
      decoded.rng.obj = rng
      expect(decoded).toStrictEqual(game)
    }))
  })

  describe('coordByPieceIdxDeprecated', () => {
    const puzzleInfo: PuzzleInfo = {
      table: { width: 0, height: 0 },
      targetTiles: 0,
      width: 10,
      height: 10,
      tileSize: 5,
      tileDrawSize: 0,
      tileMarginWidth: 0,
      tileDrawOffset: 0,
      snapDistance: 0,
      tiles: 0,
      tilesX: 0,
      tilesY: 0,
      shapes: [],
      image: defaultImageInfo(),
    }

    it('works', () => {
      expect(Util.coordByPieceIdxDeprecated(puzzleInfo, 5)).toStrictEqual({ 'x': 1, 'y': 2 })
      expect(Util.coordByPieceIdxDeprecated(puzzleInfo, 999)).toStrictEqual({ 'x': 1, 'y': 499 })
    })
  })

  describe('hash', () => {
    const testCases = [
      { str: 'some str', expected: 1503307013 },
      { str: '', expected: 0 },
    ]

    testCases.forEach(({ str, expected }) => it('hash $str', () => {
      expect(Util.hash(str)).toBe(expected)
    }))
  })

  describe('asQueryArgs', () => {
    const testCases = [
      { data: { hell: 'yo' }, expected: '?hell=yo' },
      { data: { a: 56, hell: 'y o' }, expected: '?a=56&hell=y%20o' },
      { data: { 'b  la': '?^%123' }, expected: '?b%20%20la=%3F%5E%25123' },
    ]

    testCases.forEach(({ data, expected }) => it('asQueryArgs $data', () => {
      expect(Util.asQueryArgs(data)).toBe(expected)
    }))
  })

  describe('clamp', () => {
    const testCases = [
      { val: -100, min: -10, max: 10, expected: -10 },
      { val: 100, min: -10, max: 10, expected: 10 },
      { val: 0, min: -10, max: 10, expected: 0 },
    ]

    testCases.forEach(({ val, min, max, expected }) => it(`${min} <= ${val} <= ${max}`, () => {
      const actual = clamp(val, min, max)
      expect(actual).toEqual(expected)
    }))
  })
})
