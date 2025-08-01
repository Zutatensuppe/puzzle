import Util from '../../common/src/Util'
import type { Rng } from '../../common/src/Rng'
import { EncodedPieceIdx, PieceRotation, RotationMode } from '../../common/src/Types'
import type { EncodedPiece, Puzzle, ShapeMode, ImageInfo, Timestamp } from '../../common/src/Types'
import type { Dim, Point } from '../../common/src/Geometry'
import { determinePuzzleInfo, determinePuzzlePieceShapes } from '../../common/src/Puzzle'
import type { PuzzleCreationInfo } from '../../common/src/Puzzle'

export class PuzzleService {
  createPuzzle(
    rng: Rng,
    targetPieceCount: number,
    image: ImageInfo,
    started: Timestamp,
    shapeMode: ShapeMode,
    rotationMode: RotationMode,
    gameVersion: number,
  ): Puzzle {
    const dim: Dim = { w: image.width, h: image.height }
    const info: PuzzleCreationInfo = determinePuzzleInfo(dim, targetPieceCount)

    const rawPieces = new Array(info.pieceCount)
    for (let i = 0; i < rawPieces.length; i++) {
      rawPieces[i] = { idx: i }
    }
    const shapes = determinePuzzlePieceShapes(rng, info, shapeMode)

    let positions: Point[] = new Array(info.pieceCount)
    for (const piece of rawPieces) {
      const coord = Util.coordByPieceIdx(info, piece.idx)
      positions[piece.idx] = {
        // TODO: cant we just use info.pieceDrawSize?
        // instead of info.pieceSize, we multiply it by 1.5
        // to spread the pieces a bit
        x: coord.x * info.pieceSize * 1.5,
        y: coord.y * info.pieceSize * 1.5,
      }
    }
    const tableDim = this.determineTableDim(info, gameVersion)

    const off = info.pieceSize * 1.5
    const last: Point = {
      x: (tableDim.w - info.width) / 2 - (1 * off),
      y: (tableDim.h - info.height) / 2 - (2 * off),
    }
    let countX = Math.ceil(info.width / off) + 2
    let countY = Math.ceil(info.height / off) + 2

    let diffX = off
    let diffY = 0
    let index = 0
    for (const pos of positions) {
      pos.x = last.x
      pos.y = last.y
      last.x += diffX
      last.y += diffY
      index++
      // did we move horizontally?
      if (diffX !== 0) {
        if (index === countX) {
          diffY = diffX
          countY++
          diffX = 0
          index = 0
        }
      } else {
        if (index === countY) {
          diffX = -diffY
          countX++
          diffY = 0
          index = 0
        }
      }
    }

    // then shuffle the positions
    positions = rng.shuffle(positions)

    const pieces: EncodedPiece[] = rawPieces.map(piece => {
      const encodedPiece: EncodedPiece = [] as unknown as EncodedPiece
      encodedPiece[EncodedPieceIdx.IDX] = piece.idx // index of piece in the array
      encodedPiece[EncodedPieceIdx.GROUP] = 0 // if grouped with other pieces
      encodedPiece[EncodedPieceIdx.Z] = 0 // z index of the piece

      // who owns the piece
      // 0 = free for taking
      // -1 = finished
      // other values: id of player who has the piece
      encodedPiece[EncodedPieceIdx.OWNER] = 0

      // physical current position of the piece (x/y in pixels)
      // this position is the initial position only and is the
      // value that changes when moving a piece
      encodedPiece[EncodedPieceIdx.POS_X] = positions[piece.idx].x
      encodedPiece[EncodedPieceIdx.POS_Y] = positions[piece.idx].y

      encodedPiece[EncodedPieceIdx.ROTATION] = rotationMode === RotationMode.ORTHOGONAL
        ? rng.choice([PieceRotation.R0, PieceRotation.R90, PieceRotation.R180, PieceRotation.R270])
        : PieceRotation.R0
      return encodedPiece
    })

    // Complete puzzle object
    return {
      // pieces array
      tiles: pieces,
      // game data for puzzle, data changes during the game
      data: {
        // TODO: maybe calculate this each time?
        maxZ: 0,     // max z of all pieces
        maxGroup: 0, // max group of all pieces
        started, // start timestamp
        finished: 0, // finish timestamp
      },
      // static puzzle information. stays same for complete duration of
      // the game
      info: {
        table: {
          width: tableDim.w,
          height: tableDim.h,
        },
        // information that was used to create the puzzle
        targetTiles: targetPieceCount,
        image: image,

        width: info.width, // actual puzzle width (same as bitmap.width)
        height: info.height, // actual puzzle height (same as bitmap.height)
        tileSize: info.pieceSize, // width/height of each piece (without tabs)
        tileDrawSize: info.pieceDrawSize, // width/height of each piece (with tabs)
        tileMarginWidth: info.pieceMarginWidth,
        // offset in x and y when drawing tiles, so that they appear to be at pos
        tileDrawOffset: (info.pieceDrawSize - info.pieceSize) / -2,
        // max distance between tile and destination that
        // makes the tile snap to destination
        snapDistance: info.pieceSize / 2,
        tiles: info.pieceCount, // the final number of pieces in the puzzle
        tilesX: info.pieceCountHorizontal, // number of pieces each row
        tilesY: info.pieceCountVertical, // number of pieces each col
        // ( index => {x, y} )
        // this is not the physical coordinate, but
        // the piece_coordinate
        // this can be used to determine where the
        // final destination of a piece is
        shapes: shapes, // piece shapes
      },
    }
  }

  determineTableDim (info: PuzzleCreationInfo, gameVersion: number): Dim {
    if (gameVersion <= 3) {
      return { w: info.width * 3, h: info.height * 3 }
    }
    const tableSize = Math.max(info.width, info.height) * 6
    return { w: tableSize, h: tableSize }
  }
}
