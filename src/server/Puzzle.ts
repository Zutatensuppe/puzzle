import Util from './../common/Util'
import { Rng } from './../common/Rng'
import Images from './Images'
import { EncodedPiece, EncodedPieceShape, PieceShape, Puzzle, ShapeMode, ImageInfo } from '../common/Types'
import { Dim, Point } from '../common/Geometry'
import config from './Config'

export interface PuzzleCreationInfo {
  width: number
  height: number
  tileSize: number
  tileMarginWidth: number
  tileDrawSize: number
  tiles: number
  tilesX: number
  tilesY: number
}

// cut size of each puzzle tile in the
// final resized version of the puzzle image
const TILE_SIZE = 64

async function createPuzzle(
  rng: Rng,
  targetTiles: number,
  image: ImageInfo,
  ts: number,
  shapeMode: ShapeMode
): Promise<Puzzle> {
  const imagePath = `${config.dir.UPLOAD_DIR}/${image.filename}`
  const imageUrl = image.url

  // determine puzzle information from the image dimensions
  const dim = await Images.getDimensions(imagePath)
  if (!dim.w || !dim.h) {
    throw `[ 2021-05-16 invalid dimension for path ${imagePath} ]`
  }
  const info: PuzzleCreationInfo = determinePuzzleInfo(dim, targetTiles)

  const rawPieces = new Array(info.tiles)
  for (let i = 0; i < rawPieces.length; i++) {
    rawPieces[i] = { idx: i }
  }
  const shapes = determinePuzzleTileShapes(rng, info, shapeMode)

  let positions: Point[] = new Array(info.tiles)
  for (const piece of rawPieces) {
    const coord = Util.coordByPieceIdx(info, piece.idx)
    positions[piece.idx] = {
      // instead of info.tileSize, we use info.tileDrawSize
      // to spread the tiles a bit
      x: coord.x * info.tileSize * 1.5,
      y: coord.y * info.tileSize * 1.5,
    }
  }

  const tableWidth = info.width * 3
  const tableHeight = info.height * 3

  const off = info.tileSize * 1.5
  const last: Point = {
    x: info.width - (1 * off),
    y: info.height - (2 * off),
  }
  let countX = Math.ceil(info.width / off) + 2
  let countY = Math.ceil(info.height / off) + 2

  let diffX = off
  let diffY = 0
  let index = 0
  for (const pos of positions) {
    pos.x = last.x
    pos.y = last.y
    last.x+=diffX
    last.y+=diffY
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

  const pieces: Array<EncodedPiece> = rawPieces.map(piece => {
    return Util.encodePiece({
      idx: piece.idx, // index of tile in the array
      group: 0, // if grouped with other tiles
      z: 0, // z index of the tile

      // who owns the tile
      // 0 = free for taking
      // -1 = finished
      // other values: id of player who has the tile
      owner: 0,

      // physical current position of the tile (x/y in pixels)
      // this position is the initial position only and is the
      // value that changes when moving a tile
      pos: positions[piece.idx],
    })
  })

  // Complete puzzle object
  return {
    // tiles array
    tiles: pieces,
    // game data for puzzle, data changes during the game
    data: {
      // TODO: maybe calculate this each time?
      maxZ: 0,     // max z of all pieces
      maxGroup: 0, // max group of all pieces
      started: ts, // start timestamp
      finished: 0, // finish timestamp
    },
    // static puzzle information. stays same for complete duration of
    // the game
    info: {
      table: {
        width: tableWidth,
        height: tableHeight,
      },
      // information that was used to create the puzzle
      targetTiles: targetTiles,
      imageUrl, // todo: remove
      image: image,

      width: info.width, // actual puzzle width (same as bitmap.width)
      height: info.height, // actual puzzle height (same as bitmap.height)
      tileSize: info.tileSize, // width/height of each tile (without tabs)
      tileDrawSize: info.tileDrawSize, // width/height of each tile (with tabs)
      tileMarginWidth: info.tileMarginWidth,
      // offset in x and y when drawing tiles, so that they appear to be at pos
      tileDrawOffset: (info.tileDrawSize - info.tileSize) / -2,
      // max distance between tile and destination that
      // makes the tile snap to destination
      snapDistance: info.tileSize / 2,
      tiles: info.tiles, // the final number of tiles in the puzzle
      tilesX: info.tilesX, // number of tiles each row
      tilesY: info.tilesY, // number of tiles each col
      // ( index => {x, y} )
      // this is not the physical coordinate, but
      // the tile_coordinate
      // this can be used to determine where the
      // final destination of a tile is
      shapes: shapes, // tile shapes
    },
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

function determinePuzzleTileShapes(
  rng: Rng,
  info: PuzzleCreationInfo,
  shapeMode: ShapeMode
): Array<EncodedPieceShape> {
  const tabs: number[] = determineTabs(shapeMode)
  const shapes: Array<PieceShape> = new Array(info.tiles)
  for (let i = 0; i < info.tiles; i++) {
    const coord = Util.coordByPieceIdx(info, i)
    shapes[i] = {
      top: coord.y === 0 ? 0 : shapes[i - info.tilesX].bottom * -1,
      right: coord.x === info.tilesX - 1 ? 0 : rng.choice(tabs),
      left: coord.x === 0 ? 0 : shapes[i - 1].right * -1,
      bottom: coord.y === info.tilesY - 1 ? 0 : rng.choice(tabs),
    }
  }
  return shapes.map(Util.encodeShape)
}

const determineTilesXY = (
  dim: Dim,
  targetTiles: number
): { tilesX: number, tilesY: number } => {
  const w_ = dim.w < dim.h ? (dim.w * dim.h) : (dim.w * dim.w)
  const h_ = dim.w < dim.h ? (dim.h * dim.h) : (dim.w * dim.h)
  let size = 0
  let tiles = 0
  do {
    size++
    tiles = Math.floor(w_ / size) * Math.floor(h_ / size)
  } while (tiles >= targetTiles)
  size--
  return {
    tilesX: Math.round(w_ / size),
    tilesY: Math.round(h_ / size),
  }
}

const determinePuzzleInfo = (
  dim: Dim,
  targetTiles: number
): PuzzleCreationInfo => {
  const {tilesX, tilesY} = determineTilesXY(dim, targetTiles)
  const tiles = tilesX * tilesY
  const tileSize = TILE_SIZE
  const width = tilesX * tileSize
  const height = tilesY * tileSize

  const tileMarginWidth = tileSize * .5;
  const tileDrawSize = Math.round(tileSize + tileMarginWidth * 2)

  return {
    width,
    height,
    tileSize,
    tileMarginWidth,
    tileDrawSize,
    tiles,
    tilesX,
    tilesY,
  }
}

export {
  createPuzzle,
}
