import sizeOf from 'image-size'
import { choice, shuffle } from './util.js'

// cut size of each puzzle tile in the
// final resized version of the puzzle image
const TILE_SIZE = 64

async function createPuzzle(targetTiles, image) {
  const imgPath = './../game' + image
  const imgUrl = image

  // load bitmap, to determine the original size of the image
  let dim = sizeOf(imgPath)

  // determine puzzle information from the bitmap
  let info = determinePuzzleInfo(dim.width, dim.height, targetTiles)

  let tiles = new Array(info.tiles)
  for (let i = 0; i < tiles.length; i++) {
    tiles[i] = {
      idx: i,
    }
  }
  const shapes = determinePuzzleTileShapes(info)

  let positions = new Array(info.tiles)
  for (let tile of tiles) {
    positions[tile.idx] ={
      // instead of info.tileSize, we use info.tileDrawSize
      // to spread the tiles a bit
      x: (info.coords[tile.idx].x) * (info.tileSize * 1.5),
      y: (info.coords[tile.idx].y) * (info.tileSize * 1.5),
    }
  }

  let tableWidth = info.width * 3
  let tableHeight = info.height * 3

  let off = (info.tileSize * 1.5)
  let last = {x: info.width - (1 * off), y: info.height - (2 * off) }
  let count_x = Math.ceil(info.width / off) + 2
  let count_y = Math.ceil(info.height / off) + 2

  let diff_x = off
  let diff_y = 0
  let index = 0
  for (let pos of positions) {
    pos.x = last.x
    pos.y = last.y
    last.x+=diff_x
    last.y+=diff_y
    index++
    // did we move horizontally?
    if (diff_x !== 0) {
      if (index === count_x) {
        diff_y = diff_x
        count_y ++
        diff_x = 0
        index = 0
      }
    } else {
      if (index === count_y) {
        diff_x = -diff_y
        count_x ++
        diff_y = 0
        index = 0
      }
    }
  }

  // then shuffle the positions
  positions = shuffle(positions)

  tiles = tiles.map(tile => {
    return {
      idx: tile.idx, // index of tile in the array
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
      pos: positions[tile.idx],
    }
  })

  // Complete puzzle object
  const p = {
    // tiles array
    tiles,
    // game data for puzzle, data changes during the game
    data: {
      // TODO: maybe calculate this each time?
      maxZ: 0,     // max z of all pieces
      maxGroup: 0, // max group of all pieces
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
      imageUrl: imgUrl,

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
      tiles_x: info.tiles_x, // number of tiles each row
      tiles_y: info.tiles_y, // number of tiles each col
      coords: info.coords, // map of tile index to its coordinates
      // ( index => {x, y} )
      // this is not the physical coordinate, but
      // the tile_coordinate
      // this can be used to determine where the
      // final destination of a tile is
      shapes: shapes, // tile shapes
    },
  }
  return p
}

function determinePuzzleTileShapes(info) {
  const tabs = [-1, 1]

  const shapes = new Array(info.tiles)
  for (let i = 0; i < info.tiles; i++) {
    shapes[i] = {
      top: info.coords[i].y === 0 ? 0 : shapes[i - info.tiles_x].bottom * -1,
      right: info.coords[i].x === info.tiles_x - 1 ? 0 : choice(tabs),
      left: info.coords[i].x === 0 ? 0 : shapes[i - 1].right * -1,
      bottom: info.coords[i].y === info.tiles_y - 1 ? 0 : choice(tabs),
    }
  }
  return shapes
}

const determinePuzzleInfo = (w, h, targetTiles) => {
  let tileSize = 0
  let tiles = 0
  do {
    tileSize++
    tiles = tilesFit(w, h, tileSize)
  } while (tiles >= targetTiles)
  tileSize--

  tiles = tilesFit(w, h, tileSize)
  const tiles_x = Math.round(w / tileSize)
  const tiles_y = Math.round(h / tileSize)
  tiles = tiles_x * tiles_y

  // then resize to final TILE_SIZE (which is always the same)
  tileSize = TILE_SIZE
  const width = tiles_x * tileSize
  const height = tiles_y * tileSize
  const coords = coordsByNum({ width, height, tileSize, tiles })

  const tileMarginWidth = tileSize * .5;
  const tileDrawSize = Math.round(tileSize + tileMarginWidth * 2)

  return {
    width,
    height,
    tileSize,
    tileMarginWidth,
    tileDrawSize,
    tiles,
    tiles_x,
    tiles_y,
    coords,
  }
}

const tilesFit = (w, h, size) => Math.floor(w / size) * Math.floor(h / size)

const coordsByNum = (puzzleInfo) => {
  const w_tiles = puzzleInfo.width / puzzleInfo.tileSize
  const coords = new Array(puzzleInfo.tiles)
  for (let i = 0; i < puzzleInfo.tiles; i++) {
    const y = Math.floor(i / w_tiles)
    const x = i % w_tiles
    coords[i] = { x, y }
  }
  return coords
}

export {
  createPuzzle,
}
