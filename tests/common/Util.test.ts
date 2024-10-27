import { EncodedGame, EncodedGameLegacy, EncodedPiece, EncodedPlayer, Game, Piece, Player, Puzzle, PuzzleInfo } from '../../src/common/Types'
import Util, { clamp } from '../../src/common/Util'
import { describe, expect, it } from 'vitest'

describe('Util', () => {
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
      choice: <T>(array: Array<T>): T => array[0],
      shuffle: <T>(array: Array<T>): Array<T> => array,
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
      image: {
        id: 0,
        uploaderName: '',
        uploaderUserId: 0,
        filename: '',
        url: '',
        copyrightName: '',
        copyrightURL: '',
        title: '',
        tags: [],
        created: 0,
        gameCount: 0,
        height: 0,
        width: 0,
        private: false,
      },
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
        game: { id: 'id', rng: { type: 'asd', obj: rng }, puzzle: puzzle, players: [], scoreMode: 1, shapeMode: 1, snapMode: 1, creatorUserId: 1, hasReplay: true, gameVersion: 1, private: true } as Game,
        encoded: ['id', 'asd', { rand_high: 1, rand_low: 1 }, puzzle, [], 1, 1, 1, 1, true, 1, true] as EncodedGameLegacy,
      },
      {
        game: { id: 'id', rng: { type: 'asd', obj: rng }, puzzle: puzzle, players: [], scoreMode: 1, shapeMode: 1, snapMode: 1, creatorUserId: 1, hasReplay: true, gameVersion: 1, private: true, crop: { x: 0, y: 0, w: 100, h: 100 } } as Game,
        encoded: ['id', 'asd', { rand_high: 1, rand_low: 1 }, puzzle, [], 1, 1, 1, 1, true, 1, true, { x: 0, y: 0, w: 100, h: 100 }] as EncodedGame,
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
      image: {
        id: 0,
        uploaderName: '',
        uploaderUserId: 0,
        filename: '',
        url: '',
        copyrightName: '',
        copyrightURL: '',
        title: '',
        tags: [],
        created: 0,
        gameCount: 0,
        height: 0,
        width: 0,
        private: false,
      },
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
