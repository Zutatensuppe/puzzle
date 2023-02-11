import { Dim } from "./Geometry"
import { Rng } from "./Rng"
import { EncodedPieceShape, PieceShape, ShapeMode } from "./Types"
import Util from "./Util"

export interface PuzzleCreationInfo {
  width: number
  height: number
  pieceSize: number
  pieceMarginWidth: number
  pieceDrawSize: number
  pieceCount: number
  pieceCountHorizontal: number
  pieceCountVertical: number
}

// cut size of each puzzle piece in the
// final resized version of the puzzle image
export const PIECE_SIZE = 64

const determinePiecesXY = (
  dim: Dim,
  targetPiecesCount: number
): { countHorizontal: number, countVertical: number } => {
  const w_ = dim.w < dim.h ? (dim.w * dim.h) : (dim.w * dim.w)
  const h_ = dim.w < dim.h ? (dim.h * dim.h) : (dim.w * dim.h)
  let size = 0
  let pieces = 0
  do {
    size++
    pieces = Math.floor(w_ / size) * Math.floor(h_ / size)
  } while (pieces >= targetPiecesCount)
  if (pieces !== targetPiecesCount) {
    size--
  }
  return {
    countHorizontal: Math.floor(w_ / size),
    countVertical: Math.floor(h_ / size),
  }
}

export const determinePuzzleInfo = (
  dim: Dim,
  targetPieceCount: number
): PuzzleCreationInfo => {
  const { countHorizontal, countVertical } = determinePiecesXY(dim, targetPieceCount)
  const pieceCount = countHorizontal * countVertical
  const pieceSize = PIECE_SIZE
  const width = countHorizontal * pieceSize
  const height = countVertical * pieceSize

  const pieceMarginWidth = pieceSize * .5;
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
  }
}

function determineTabs (shapeMode: ShapeMode): number[] {
  switch(shapeMode) {
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
  shapeMode: ShapeMode
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
