import { Dim } from './Geometry'
import { Rng } from './Rng'
import { EncodedPieceShape, PieceShape, ShapeMode } from './Types'
import Util from './Util'

export interface PuzzleCreationInfo {
  width: number
  height: number
  pieceSize: number
  pieceMarginWidth: number
  pieceDrawSize: number
  pieceCount: number
  pieceCountHorizontal: number
  pieceCountVertical: number
  desiredPieceCount: number
}

// cut size of each puzzle piece in the
// final resized version of the puzzle image
export const PIECE_SIZE = 64

const determinePiecesXY = (
  dim: Dim,
  desiredPieceCount: number,
): { countHorizontal: number, countVertical: number } => {
  if (desiredPieceCount <= 0 || isNaN(desiredPieceCount)) {
    return { countHorizontal: 0, countVertical: 0 }
  }
  const w = dim.w < dim.h ? (dim.w * dim.h) : (dim.w * dim.w)
  const h = dim.w < dim.h ? (dim.h * dim.h) : (dim.w * dim.h)
  const totalArea = w * h

  // Initial estimate for size
  let size = Math.floor(Math.sqrt(totalArea / desiredPieceCount))
  let pieces = Math.floor(w / size) * Math.floor(h / size)

  // kind of binary search to find the best counts
  // we get closer to the desired piece count fast by starting
  // with a high sizeChange and bitshifting it in each iteration
  let sizeChange = 128 // 128, 64, 32, 16, 8, 4, 2, 1
  while (sizeChange >= 1) {
    while (pieces < desiredPieceCount) {
      size -= sizeChange
      pieces = Math.floor(w / size) * Math.floor(h / size)
    }
    while (pieces >= desiredPieceCount) {
      size += sizeChange
      pieces = Math.floor(w / size) * Math.floor(h / size)
    }
    sizeChange = sizeChange >> 1
  }
  size--

  return {
    countHorizontal: Math.floor(w / size),
    countVertical: Math.floor(h / size),
  }
}

export const determinePuzzleInfo = (
  dim: Dim,
  desiredPieceCount: number,
): PuzzleCreationInfo => {
  const { countHorizontal, countVertical } = determinePiecesXY(dim, desiredPieceCount)
  const pieceCount = countHorizontal * countVertical
  const pieceSize = PIECE_SIZE
  const width = countHorizontal * pieceSize
  const height = countVertical * pieceSize

  const pieceMarginWidth = pieceSize * .5
  const pieceDrawSize = Math.round(pieceSize + pieceMarginWidth * 2)

  return {
    width,
    height,
    pieceSize: pieceSize,
    pieceMarginWidth: pieceMarginWidth,
    pieceDrawSize: pieceDrawSize,
    pieceCount: pieceCount,
    pieceCountHorizontal: countHorizontal,
    pieceCountVertical: countVertical,
    desiredPieceCount: desiredPieceCount,
  }
}

function determineTabs(shapeMode: ShapeMode): number[] {
  switch (shapeMode) {
    case ShapeMode.ANY:
      return [-1, 0, 1]
    case ShapeMode.FLAT:
      return [0]
    case ShapeMode.NORMAL:
    default:
      return [-1, 1]
  }
}

export function determinePuzzlePieceShapes(
  rng: Rng,
  info: PuzzleCreationInfo,
  shapeMode: ShapeMode,
): Array<EncodedPieceShape> {
  const tabs: number[] = determineTabs(shapeMode)
  const shapes: Array<PieceShape> = new Array(info.pieceCount)
  for (let i = 0; i < info.pieceCount; i++) {
    const coord = Util.coordByPieceIdx(info, i)
    shapes[i] = {
      top: coord.y === 0 ? 0 : shapes[i - info.pieceCountHorizontal].bottom * -1,
      right: coord.x === info.pieceCountHorizontal - 1 ? 0 : rng.choice(tabs),
      left: coord.x === 0 ? 0 : shapes[i - 1].right * -1,
      bottom: coord.y === info.pieceCountVertical - 1 ? 0 : rng.choice(tabs),
    }
  }

  return shapes.map(Util.encodeShape)
}


export default {
  determinePuzzleInfo,
  determinePuzzlePieceShapes,
}
