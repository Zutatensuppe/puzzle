import { assert, describe, it } from 'vitest'
import { determinePuzzleInfo } from './Puzzle'

describe('determinePuzzleInfo', () => {
  [
    {
      dim: { w: 1706, h: 1000 },
      desiredPieceCount: 700,
      expected: {
        width: 2240,
        height: 1280,
        pieceSize: 64,
        pieceMarginWidth: 32,
        pieceDrawSize: 128,
        pieceCount: 700,
        pieceCountHorizontal: 35,
        pieceCountVertical: 20,
        desiredPieceCount: 700,
      },
    },
    {
      dim: { w: 1706, h: 1000 },
      desiredPieceCount: 701,
      expected: {
        width: 2240,
        height: 1344,
        pieceSize: 64,
        pieceMarginWidth: 32,
        pieceDrawSize: 128,
        pieceCount: 735,
        pieceCountHorizontal: 35,
        pieceCountVertical: 21,
        desiredPieceCount: 701,
      },
    },
    {
      dim: { w: 1706, h: 1000 },
      desiredPieceCount: 735,
      expected: {
        width: 2240,
        height: 1344,
        pieceSize: 64,
        pieceMarginWidth: 32,
        pieceDrawSize: 128,
        pieceCount: 735,
        pieceCountHorizontal: 35,
        pieceCountVertical: 21,
        desiredPieceCount: 735,
      },
    },
    {
      dim: { w: 1706, h: 1000 },
      desiredPieceCount: 2_000_000,
      expected: {
        width: 118208,
        height: 69312,
        pieceSize: 64,
        pieceMarginWidth: 32,
        pieceDrawSize: 128,
        pieceCount: 2000301,
        pieceCountHorizontal: 1847,
        pieceCountVertical: 1083,
        desiredPieceCount: 2_000_000,
      },
    },
  ].forEach(({ dim, desiredPieceCount, expected }) => it('determinePieceCount', () => {
    const actual = determinePuzzleInfo(dim, desiredPieceCount)
    assert.deepStrictEqual(actual, expected)
  }))
})
