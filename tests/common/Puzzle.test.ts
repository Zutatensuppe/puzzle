import { assert, describe, it } from "vitest";
import { determinePuzzleInfo } from "../../src/common/Puzzle";

describe('determinePuzzleInfo', () => {
  [
    {
      dim: { w: 1706, h: 1000 },
      targetPieceCount: 700,
      expected: {
        width: 2240,
        height: 1280,
        pieceSize: 64,
        pieceMarginWidth: 32,
        pieceDrawSize: 128,
        pieceCount: 700,
        pieceCountHorizontal: 35,
        pieceCountVertical: 20,
      },
    },
    {
      dim: { w: 1706, h: 1000 },
      targetPieceCount: 701,
      expected: {
        width: 2240,
        height: 1344,
        pieceSize: 64,
        pieceMarginWidth: 32,
        pieceDrawSize: 128,
        pieceCount: 735,
        pieceCountHorizontal: 35,
        pieceCountVertical: 21,
      },
    },
    {
      dim: { w: 1706, h: 1000 },
      targetPieceCount: 735,
      expected: {
        width: 2240,
        height: 1344,
        pieceSize: 64,
        pieceMarginWidth: 32,
        pieceDrawSize: 128,
        pieceCount: 735,
        pieceCountHorizontal: 35,
        pieceCountVertical: 21,
      },
    },
  ].forEach(({ dim, targetPieceCount, expected }) => it('determinePieceCount', () => {
    const actual = determinePuzzleInfo(dim, targetPieceCount)
    assert.deepStrictEqual(actual, expected)
  }))
})
