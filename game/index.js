"use strict"
import CanvasAdapter from './CanvasAdapter.js'
import BoundingRectangle from './BoundingRectangle.js'
import Bitmap from './Bitmap.js'
import {run} from './gameloop.js'
import Camera from './Camera.js'
import Point from './Point.js'
import EventAdapter from './EventAdapter.js'
import { choice } from './util.js'
import WsClient from './WsClient.js'

if (!WS_ADDRESS) throw '[ WS_ADDRESS not set ]'

const TILE_SIZE = 64 // cut size of each puzzle tile in the
                     // final resized version of the puzzle image
const TARGET_TILES = 1000 // desired number of tiles
                         // actual calculated number can be higher
const IMAGES = [
    './example-images/ima_86ec3fa.jpeg',
    './example-images/saechsische_schweiz.jpg',
    './example-images/132-2048x1365.jpg',
]
const IMAGE_URL = IMAGES[0]

function createCanvas(width = 0, height = 0) {
    const canvas = document.createElement('canvas')
    canvas.width = width === 0 ? window.innerWidth : width
    canvas.height = height === 0 ? window.innerHeight : height
    return canvas
}

function addCanvasToDom(canvas) {
    document.body.append(canvas)
    return canvas
}

function fillBitmap (bitmap, rgba) {
    const len = bitmap.width * bitmap.height * 4
    bitmap._data = new Uint8ClampedArray(len)
    for (let i = 0; i < len; i+=4) {
        bitmap._data[i] = rgba[0]
        bitmap._data[i + 1] = rgba[1]
        bitmap._data[i + 2] = rgba[2]
        bitmap._data[i + 3] = rgba[3]
    }
}

function fillBitmapCapped(bitmap, rgba, rect_cap) {
  if (!rect_cap) {
    return fillBitmap(bitmap, rgba)
  }
  let startX = Math.floor(rect_cap.x0)
  let startY = Math.floor(rect_cap.y0)

  let endX = Math.ceil(rect_cap.x1)
  let endY = Math.ceil(rect_cap.y1)

  for (let x = startX; x < endX; x++) {
    for (let y = startY; y < endY; y++) {
      bitmap.putPix(x, y, rgba)
    }
  }
}

function mapBitmapToBitmap (bitmap_src, rect_src, bitmap_dst, rect_dst) {
    const tmp = new Uint8ClampedArray(4)
    const w_f = (rect_src.width) / (rect_dst.width)
    const h_f = (rect_src.height) / (rect_dst.height)

    let startX = Math.max(rect_dst.x0, Math.floor((-rect_src.x0 / w_f) + rect_dst.x0))
    let startY = Math.max(rect_dst.y0, Math.floor((-rect_src.y0 / h_f) + rect_dst.y0))

    let endX = Math.min(rect_dst.x1, Math.ceil(((bitmap_src._w - rect_src.x0) / w_f) + rect_dst.x0))
    let endY = Math.min(rect_dst.y1, Math.ceil(((bitmap_src._h - rect_src.y0) / h_f) + rect_dst.y0))

    for (let x = startX; x < endX; x++) {
        for (let y = startY; y < endY; y++) {
            const src_x = rect_src.x0 + Math.floor((x - rect_dst.x0) * w_f)
            const src_y = rect_src.y0 + Math.floor((y - rect_dst.y0) * h_f)
            if (bitmap_src.getPix(src_x, src_y, tmp)) {
                if (tmp[3] === 255) {
                    bitmap_dst.putPix(x, y, tmp)
                }
            }
        }
    }
}

function mapBitmapToBitmapCapped (bitmap_src, rect_src, bitmap_dst, rect_dst, rect_cap) {
    if (!rect_cap) {
        return mapBitmapToBitmap(bitmap_src, rect_src, bitmap_dst, rect_dst)
    }
    const tmp = new Uint8ClampedArray(4)
    const w_f = (rect_src.width) / (rect_dst.width)
    const h_f = (rect_src.height) / (rect_dst.height)

    let startX = Math.floor(Math.max(rect_cap.x0, rect_dst.x0, (-rect_src.x0 / w_f) + rect_dst.x0))
    let startY = Math.floor(Math.max(rect_cap.y0, rect_dst.y0, (-rect_src.y0 / h_f) + rect_dst.y0))

    let endX = Math.ceil(Math.min(rect_cap.x1, rect_dst.x1, ((bitmap_src._w - rect_src.x0) / w_f) + rect_dst.x0))
    let endY = Math.ceil(Math.min(rect_cap.y1, rect_dst.y1, ((bitmap_src._h - rect_src.y0) / h_f) + rect_dst.y0))

    for (let x = startX; x < endX; x++) {
        for (let y = startY; y < endY; y++) {
            const src_x = rect_src.x0 + Math.floor((x - rect_dst.x0) * w_f)
            const src_y = rect_src.y0 + Math.floor((y - rect_dst.y0) * h_f)
            if (bitmap_src.getPix(src_x, src_y, tmp)) {
                if (tmp[3] === 255) {
                    bitmap_dst.putPix(x, y, tmp)
                }
            }
        }
    }
}

function mapBitmapToAdapterCapped (src, rect_src, dst, rect_dst, rect_cap) {
    if (!rect_cap) {
        return mapBitmapToAdapter(src, rect_src, dst, rect_dst)
    }
    const tmp = new Uint8ClampedArray(4)
    const w_f = (rect_src.width) / (rect_dst.width)
    const h_f = (rect_src.height) / (rect_dst.height)

    let startX = Math.floor(Math.max(rect_cap.x0, rect_dst.x0, (-rect_src.x0 / w_f) + rect_dst.x0))
    let startY = Math.floor(Math.max(rect_cap.y0, rect_dst.y0, (-rect_src.y0 / h_f) + rect_dst.y0))

    let endX = Math.ceil(Math.min(rect_cap.x1, rect_dst.x1, ((src._w - rect_src.x0) / w_f) + rect_dst.x0))
    let endY = Math.ceil(Math.min(rect_cap.y1, rect_dst.y1, ((src._h - rect_src.y0) / h_f) + rect_dst.y0))

    for (let x = startX; x < endX; x++) {
        for (let y = startY; y < endY; y++) {
            const src_x = rect_src.x0 + Math.floor((x - rect_dst.x0) * w_f)
            const src_y = rect_src.y0 + Math.floor((y - rect_dst.y0) * h_f)
            if (src.getPix(src_x, src_y, tmp)) {
                if (tmp[3] === 255) {
                    dst.putPix(x, y, tmp)
                }
            }
        }
    }
    adapter_dst.apply()
}

function mapBitmapToAdapter (bitmap_src, rect_src, adapter_dst, rect_dst) {
    const tmp = new Uint8ClampedArray(4)
    const w_f = (rect_src.x1 - rect_src.x0) / (rect_dst.x1 - rect_dst.x0)
    const h_f = (rect_src.y1 - rect_src.y0) / (rect_dst.y1 - rect_dst.y0)

    let startX = Math.max(rect_dst.x0, Math.floor((-rect_src.x0 / w_f) + rect_dst.x0))
    let startY = Math.max(rect_dst.y0, Math.floor((-rect_src.y0 / h_f) + rect_dst.y0))

    let endX = Math.min(rect_dst.x1, Math.ceil(((bitmap_src._w - rect_src.x0) / w_f) + rect_dst.x0))
    let endY = Math.min(rect_dst.y1, Math.ceil(((bitmap_src._h - rect_src.y0) / h_f) + rect_dst.y0))

    for (let x = startX; x < endX; x++) {
        for (let y = startY; y < endY; y++) {
            const src_x = rect_src.x0 + Math.floor((x - rect_dst.x0) * w_f)
            const src_y = rect_src.y0 + Math.floor((y - rect_dst.y0) * h_f)
            if (bitmap_src.getPix(src_x, src_y, tmp)) {
                if (tmp[3] === 255) {
                    adapter_dst.putPix(x, y, tmp)
                }
            }
        }
    }
    adapter_dst.apply()
}

function copy(src) {
    var arr = new Uint8ClampedArray(src.length)
    arr.set(new Uint8ClampedArray(src));
    return arr
}

function dataToBitmap(w, h, data) {
    const bitmap = new Bitmap(w, h)
    bitmap._data = copy(data)
    return bitmap
}

function imageToBitmap(img) {
    const c = createCanvas(img.width, img.height)
    const ctx = c.getContext('2d')
    ctx.drawImage(img, 0, 0)
    const data = ctx.getImageData(0, 0, c.width, c.height).data

    return dataToBitmap(c.width, c.height, data)
}

function loadImageToBitmap(imagePath) {
    return new Promise((resolve) => {
        const img = new Image()
        img.onload= () => {
            resolve(imageToBitmap(img))
        }
        img.src = imagePath
    })
}

function pointInBounds(pt, rect) {
    return pt.x >= rect.x0 && pt.x <= rect.x1 && pt.y >= rect.y0 && pt.y <= rect.y1
}

const tilesFit = (w, h, size) => {
    return Math.floor(w / size) * Math.floor(h / size)
}

const coordsByNum = (puzzleInfo) => {
    const w_tiles = puzzleInfo.width / puzzleInfo.tileSize
    const coords = new Array(puzzleInfo.tiles)
    for (let i = 0; i < puzzleInfo.tiles; i++) {
        const y = Math.floor(i / w_tiles)
        const x = i % w_tiles
        coords[i] = {x, y}
    }
    return coords
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
    let tiles_x = Math.round(w / tileSize)
    let tiles_y = Math.round(h / tileSize)
    tiles = tiles_x * tiles_y

    // then resize to final TILE_SIZE (which is always the same)
    tileSize = TILE_SIZE
    let width = tiles_x * tileSize
    let height = tiles_y * tileSize
    let coords = coordsByNum({width, height, tileSize, tiles})

    var tileMarginWidth = tileSize * .5;
    var tileDrawSize = Math.round(tileSize + tileMarginWidth*2)

    const info = {
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
    return info
}

const resizeBitmap = (bitmap, width, height) => {
    const tmp = new Bitmap(width, height)
    mapBitmapToBitmap(
        bitmap,
        bitmap.getBoundingRect(),
        tmp,
        tmp.getBoundingRect()
    )
    return tmp
}

function getSurroundingTilesByIdx(puzzle, idx) {
    var _X = puzzle.info.coords[idx].x
    var _Y = puzzle.info.coords[idx].y

    return [
        // top
        _Y === 0 ? null : puzzle.tiles[idx - puzzle.info.tiles_x],
        // right
        (_X === puzzle.info.tiles_x - 1) ? null : puzzle.tiles[idx + 1],
        // bottom
        (_Y === puzzle.info.tiles_y - 1) ? null : puzzle.tiles[idx + puzzle.info.tiles_x],
        // left
        _X === 0 ? null : puzzle.tiles[idx - 1]
    ]
}

function determinePuzzleTileShapes (info) {
    const tabs = [-1, 1]

    const shapes = new Array(info.tiles)
    for (let i = 0; i < info.tiles; i++) {
        shapes[i] = {
            top: info.coords[i].y === 0 ? 0 : shapes[i - info.tiles_x].bottom * -1,
            right: info.coords[i].x === info.tiles_x -1 ? 0 : choice(tabs),
            left: info.coords[i].x === 0 ? 0 : shapes[i - 1].right * -1,
            bottom: info.coords[i].y === info.tiles_y -1 ? 0 : choice(tabs),
        }
    }
    return shapes
}

async function createPuzzleTileBitmaps (bitmap, tiles, info) {
    let img = await bitmap.toImage()
    var tileSize = info.tileSize
    var tileMarginWidth = info.tileMarginWidth
    var tileDrawSize = info.tileDrawSize
    var tileRatio = tileSize / 100.0

    var curvyCoords = [
        0, 0, 40, 15, 37, 5,
        37, 5, 40, 0, 38, -5,
        38, -5, 20, -20, 50, -20,
        50, -20, 80, -20, 62, -5,
        62, -5, 60, 0, 63, 5,
        63, 5, 65, 15, 100, 0
    ];

    const bitmaps = new Array(tiles.length)

    for (let tile of tiles) {
        let c = createCanvas(tileDrawSize, tileDrawSize)
        let ctx = c.getContext('2d')
        ctx.clearRect(0, 0,tileDrawSize, tileDrawSize)

        var topTab = info.shapes[tile.idx].top
        var rightTab = info.shapes[tile.idx].right
        var leftTab = info.shapes[tile.idx].left
        var bottomTab = info.shapes[tile.idx].bottom

        var topLeftEdge = new Point(tileMarginWidth, tileMarginWidth);
        ctx.save();
        ctx.beginPath()
        ctx.moveTo(topLeftEdge.x, topLeftEdge.y)
        for (let i = 0; i < curvyCoords.length / 6; i++) {
            var p1 = topLeftEdge.add(new Point( curvyCoords[i * 6 + 0] * tileRatio, topTab * curvyCoords[i * 6 + 1] * tileRatio) );
            var p2 = topLeftEdge.add(new Point( curvyCoords[i * 6 + 2] * tileRatio, topTab * curvyCoords[i * 6 + 3] * tileRatio) );
            var p3 = topLeftEdge.add(new Point( curvyCoords[i * 6 + 4] * tileRatio, topTab * curvyCoords[i * 6 + 5] * tileRatio) );
            ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
        }

        //Right
        var topRightEdge = topLeftEdge.add(new Point(tileSize, 0));
        for (var i = 0; i < curvyCoords.length / 6; i++) {
            var p1 = topRightEdge.add(new Point(-rightTab * curvyCoords[i * 6 + 1] * tileRatio, curvyCoords[i * 6 + 0] * tileRatio))
            var p2 = topRightEdge.add(new Point(-rightTab * curvyCoords[i * 6 + 3] * tileRatio, curvyCoords[i * 6 + 2] * tileRatio))
            var p3 = topRightEdge.add(new Point(-rightTab * curvyCoords[i * 6 + 5] * tileRatio, curvyCoords[i * 6 + 4] * tileRatio))
            ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
        }
        //Bottom
        var bottomRightEdge = topRightEdge.add(new Point(0, tileSize))
        for (var i = 0; i < curvyCoords.length / 6; i++) {
            var p1 = bottomRightEdge.sub(new Point(curvyCoords[i * 6 + 0] * tileRatio, bottomTab * curvyCoords[i * 6 + 1] * tileRatio))
            var p2 = bottomRightEdge.sub(new Point(curvyCoords[i * 6 + 2] * tileRatio, bottomTab * curvyCoords[i * 6 + 3] * tileRatio))
            var p3 = bottomRightEdge.sub(new Point(curvyCoords[i * 6 + 4] * tileRatio, bottomTab * curvyCoords[i * 6 + 5] * tileRatio))
            ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
        }
        //Left
        var bottomLeftEdge = bottomRightEdge.sub(new Point(tileSize, 0));
        for (var i = 0; i < curvyCoords.length / 6; i++) {
            var p1 = bottomLeftEdge.sub(new Point(-leftTab * curvyCoords[i * 6 + 1] * tileRatio, curvyCoords[i * 6 + 0] * tileRatio))
            var p2 = bottomLeftEdge.sub(new Point(-leftTab * curvyCoords[i * 6 + 3] * tileRatio, curvyCoords[i * 6 + 2] * tileRatio))
            var p3 = bottomLeftEdge.sub(new Point(-leftTab * curvyCoords[i * 6 + 5] * tileRatio, curvyCoords[i * 6 + 4] * tileRatio))
            ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
        }

        const srcRect = srcRectByIdx(info, tile.idx)
        ctx.clip()
        ctx.drawImage(
            img,
            srcRect.x0 - tileMarginWidth,
            srcRect.y0 - tileMarginWidth,
            tileDrawSize,
            tileDrawSize,
            0,
            0,
            tileDrawSize,
            tileDrawSize,
        )
        ctx.closePath()
        ctx.restore();


        // -----------------------------------------------------------
        // -----------------------------------------------------------
        var topLeftEdge = new Point(tileMarginWidth, tileMarginWidth);
        ctx.save()
        ctx.beginPath()
        ctx.moveTo(topLeftEdge.x, topLeftEdge.y)
        for (let i = 0; i < curvyCoords.length / 6; i++) {
            var p1 = topLeftEdge.add(new Point( curvyCoords[i * 6 + 0] * tileRatio, topTab * curvyCoords[i * 6 + 1] * tileRatio) );
            var p2 = topLeftEdge.add(new Point( curvyCoords[i * 6 + 2] * tileRatio, topTab * curvyCoords[i * 6 + 3] * tileRatio) );
            var p3 = topLeftEdge.add(new Point( curvyCoords[i * 6 + 4] * tileRatio, topTab * curvyCoords[i * 6 + 5] * tileRatio) );
            ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
        }

        //Right
        var topRightEdge = topLeftEdge.add(new Point(tileSize, 0));
        for (var i = 0; i < curvyCoords.length / 6; i++) {
            var p1 = topRightEdge.add(new Point(-rightTab * curvyCoords[i * 6 + 1] * tileRatio, curvyCoords[i * 6 + 0] * tileRatio))
            var p2 = topRightEdge.add(new Point(-rightTab * curvyCoords[i * 6 + 3] * tileRatio, curvyCoords[i * 6 + 2] * tileRatio))
            var p3 = topRightEdge.add(new Point(-rightTab * curvyCoords[i * 6 + 5] * tileRatio, curvyCoords[i * 6 + 4] * tileRatio))
            ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
        }
        //Bottom
        var bottomRightEdge = topRightEdge.add(new Point(0, tileSize))
        for (var i = 0; i < curvyCoords.length / 6; i++) {
            var p1 = bottomRightEdge.sub(new Point(curvyCoords[i * 6 + 0] * tileRatio, bottomTab * curvyCoords[i * 6 + 1] * tileRatio))
            var p2 = bottomRightEdge.sub(new Point(curvyCoords[i * 6 + 2] * tileRatio, bottomTab * curvyCoords[i * 6 + 3] * tileRatio))
            var p3 = bottomRightEdge.sub(new Point(curvyCoords[i * 6 + 4] * tileRatio, bottomTab * curvyCoords[i * 6 + 5] * tileRatio))
            ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
        }
        //Left
        var bottomLeftEdge = bottomRightEdge.sub(new Point(tileSize, 0));
        for (var i = 0; i < curvyCoords.length / 6; i++) {
            var p1 = bottomLeftEdge.sub(new Point(-leftTab * curvyCoords[i * 6 + 1] * tileRatio, curvyCoords[i * 6 + 0] * tileRatio))
            var p2 = bottomLeftEdge.sub(new Point(-leftTab * curvyCoords[i * 6 + 3] * tileRatio, curvyCoords[i * 6 + 2] * tileRatio))
            var p3 = bottomLeftEdge.sub(new Point(-leftTab * curvyCoords[i * 6 + 5] * tileRatio, curvyCoords[i * 6 + 4] * tileRatio))
            ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
        }

        ctx.lineWidth = 2
        ctx.stroke()
        ctx.closePath()
        ctx.restore()
        // -----------------------------------------------------------
        // -----------------------------------------------------------


        const data = ctx.getImageData(0, 0, tileDrawSize, tileDrawSize).data
        const bitmap = dataToBitmap(tileDrawSize, tileDrawSize, data)

        bitmaps[tile.idx] = bitmap
    }

    return bitmaps
}

function srcRectByIdx (puzzleInfo, idx) {
    let c = puzzleInfo.coords[idx]
    let cx = c.x * puzzleInfo.tileSize
    let cy = c.y * puzzleInfo.tileSize
    return new BoundingRectangle(
        cx,
        cx + puzzleInfo.tileSize,
        cy,
        cy + puzzleInfo.tileSize
    )
}

function pointSub (a, b) {
  return {x: a.x - b.x, y: a.y - b.y}
}

function pointAdd (a, b) {
  return {x: a.x + b.x, y: a.y + b.y}
}

// Returns the index of the puzzle tile with the highest z index
// that is not finished yet and that matches the position
const unfinishedTileByPos = (puzzle, pos) => {
    let maxZ = -1
    let tileIdx = -1
    for (let idx = 0; idx < puzzle.tiles.length; idx++) {
        let tile = puzzle.tiles[idx]
        if (tile.owner === -1) {
            continue
        }

        // TODO: store collision boxes on the tiles
        const collisionRect = new BoundingRectangle(
            tile.pos.x,
            tile.pos.x + puzzle.info.tileSize - 1,
            tile.pos.y,
            tile.pos.y + puzzle.info.tileSize - 1,
        )
        if (pointInBounds(pos, collisionRect)) {
            if (maxZ === -1 || tile.z > maxZ) {
                maxZ = tile.z
                tileIdx = idx
            }
        }
    }
    return tileIdx
}

async function loadPuzzleBitmaps(puzzle) {
  // load bitmap, to determine the original size of the image
  let bitmpTmp = await loadImageToBitmap(puzzle.info.imageUrl)

  // creation of tile bitmaps
  // then create the final puzzle bitmap
  // NOTE: this can decrease OR increase in size!
  const bitmap = resizeBitmap(bitmpTmp, puzzle.info.width, puzzle.info.height)
  const bitmaps = await createPuzzleTileBitmaps(bitmap, puzzle.tiles, puzzle.info)
  // tile bitmaps
  return bitmaps
}

async function createPuzzle(targetTiles, imageUrl) {
  // load bitmap, to determine the original size of the image
  let bitmpTmp = await loadImageToBitmap(imageUrl)

  // determine puzzle information from the bitmap
  let info = determinePuzzleInfo(bitmpTmp.width, bitmpTmp.height, targetTiles)

  let tiles = new Array(info.tiles)
  for (let i = 0; i < tiles.length; i++) {
    tiles[i] = {
      idx: i,
    }
  }
  const shapes = determinePuzzleTileShapes(info)

  // Complete puzzle object
  const p = {
    // tiles array
    tiles: tiles.map(tile => {
      return {
        idx: tile.idx, // index of tile in the array
        group: 0, // if grouped with other tiles
        z: 0, // z index of the tile
        owner: 0, // who owns the tile
                  // 0 = free for taking
                  // -1 = finished
                  // other values: id of player who has the tile
        // physical current position of the tile (x/y in pixels)
        // this position is the initial position only and is the
        // value that changes when moving a tile
        // TODO: scatter the tiles on the table at the beginning
        pos: {
          x: info.coords[tile.idx].x * info.tileSize,
          y: info.coords[tile.idx].y * info.tileSize,
        },
      }
    }),
    // game data for puzzle, data changes during the game
    data: {
      // TODO: maybe calculate this each time?
      maxZ: 0,     // max z of all pieces
      maxGroup: 0, // max group of all pieces
    },
    // static puzzle information. stays same for complete duration of
    // the game
    info: {
      // information that was used to create the puzzle
      targetTiles: targetTiles,
      imageUrl: imageUrl,

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


function uniqId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2)
}

function initme() {
  return uniqId()
  let ID = localStorage.getItem("ID")
  if (!ID) {
    ID = uniqId()
    localStorage.setItem("ID", ID)
  }
  return ID
}

function setupNetwork(me) {
  const wsc = new WsClient(WS_ADDRESS, me)
  wsc.connect()
  return wsc
}

async function main () {

  // todo: maybe put in protocols, same as `me()`
  let gameId = 'asdfbla' // uniqId()
  let me = initme()
  const player = {x: 0, y: 0, down: false}

  let cursorGrab = await loadImageToBitmap('./grab.png')
  let cursorHand = await loadImageToBitmap('./hand.png')

  let conn = setupNetwork(me + '|' + gameId)
  conn.send(JSON.stringify({type: 'init', player}))
  conn.onSocket('message', async ({data}) => {
    const d = JSON.parse(data)
    let puzzle
    if (d.type === 'init') {
      if (d.puzzle) {
        puzzle = d.puzzle
        console.log('loaded from server')
      } else {
        // The game doesnt exist yet on the server, so load puzzle
        // and then give the server some info about the puzzle
        // Load puzzle and determine information about it
        // TODO: move puzzle creation to server
        puzzle = await createPuzzle(TARGET_TILES, IMAGE_URL)
        conn.send(JSON.stringify({
          type: 'init_puzzle',
          puzzle: puzzle,
        }))
        console.log('loaded from local config')
      }

      console.log('the puzzle ', puzzle)
      let bitmaps = await loadPuzzleBitmaps(puzzle)
      startGame(puzzle, bitmaps, conn)
    } else {
      // console.log(d)
    }
  })

  const _STATE = {
    changes: [],
  }
  let _STATE_CHANGED = false

  // this must be fetched from server

  const startGame = (puzzle, bitmaps, conn) => {
    // information for next render cycle
    let rerenderTable = true
    let rerenderTableRect = null
    let rerenderPlayer = true
    let rerender = true
    let redrawMinX = null
    let redrawMaxX = null
    let redrawMinY = null
    let redrawMaxY = null
    const updateDrawMinMax = (pos, offset) => {
        let x0 = pos.x - offset
        let x1 = pos.x + offset
        let y0 = pos.y - offset
        let y1 = pos.y + offset
        redrawMinX = redrawMinX === null ? x0 : Math.min(redrawMinX, x0)
        redrawMaxX = redrawMaxX === null ? x1 : Math.max(redrawMaxX, x1)
        redrawMinY = redrawMinY === null ? y0 : Math.min(redrawMinY, y0)
        redrawMaxY = redrawMaxY === null ? y1 : Math.max(redrawMaxY, y1)
    }

    conn.onSocket('message', ({data}) => {
      const d = JSON.parse(data)
      if (d.type === 'state_changed' && d.origin !== me) {
        for (let change of d.changes) {
          switch (change.type) {
            case 'change_tile': {
              updateDrawMinMax(puzzle.tiles[change.tile.idx].pos, puzzle.info.tileDrawSize)

              puzzle.tiles[change.tile.idx] = change.tile

              updateDrawMinMax(puzzle.tiles[change.tile.idx].pos, puzzle.info.tileDrawSize)
            } break;
            case 'change_data': {
              puzzle.data = change.data
            } break;
          }
        }
      }
    })

    const changePlayer = (change) => {
      for (let k of Object.keys(change)) {
        player[k] = change[k]
      }
      _STATE.changes.push({type: 'change_player', player: player})
      _STATE_CHANGED = true
    }
    const changeData = (change) => {
      for (let k of Object.keys(change)) {
        puzzle.data[k] = change[k]
      }
      _STATE.changes.push({type: 'change_data', data: puzzle.data})
      _STATE_CHANGED = true
    }

    const changeTile = (t, change) => {
      for (let k of Object.keys(change)) {
        t[k] = change[k]
      }
      _STATE.changes.push({type: 'change_tile', tile: t})
      _STATE_CHANGED = true
    }

    // Create a dom and attach adapters to it so we can work with it
    const canvas = addCanvasToDom(createCanvas())
    const adapter = new CanvasAdapter(canvas)
    const evts = new EventAdapter(canvas)

    // initialize some view data
    // this global data will change according to input events
    const cam = new Camera(canvas)

    // Information about the mouse
    const EV_DATA = {
      mouse_down_x: null,
      mouse_down_y: null,
    }

    // Information about what tile is the player currently grabbing
    let grabbingTileIdx = -1

    // The actual place for the puzzle. The tiles may
    // not be moved around infinitely, just on the (invisible)
    // puzzle table. however, the camera may move away from the table
    const puzzleTableColor = [200, 0, 0, 255]
    const puzzleTable = new Bitmap(
      puzzle.info.width * 2,
      puzzle.info.height * 2,
      puzzleTableColor
    )

    // In the middle of the table, there is a board. this is to
    // tell the player where to place the final puzzle
    const boardColor = [0, 150, 0, 255]
    const board = new Bitmap(
      puzzle.info.width,
      puzzle.info.height,
      boardColor
    )
    const boardPos = {
      x: (puzzleTable.width - board.width) / 2,
      y: (puzzleTable.height - board.height) / 2
    } // relative to table.


    // Some helper functions for working with the grabbing and snapping
    // ---------------------------------------------------------------

    // get all grouped tiles for a tile
    function getGroupedTiles(tile) {
      let grouped = []
      if (tile.group) {
        for (let other of puzzle.tiles) {
          if (other.group === tile.group) {
            grouped.push(other)
          }
        }
      } else {
        grouped.push(tile)
      }
      return grouped
    }

    // put both tiles (and their grouped tiles) in the same group
    const groupTiles = (tile, other) => {
      let targetGroup
      let searchGroups = []
      if (tile.group) {
        searchGroups.push(tile.group)
      }
      if (other.group) {
        searchGroups.push(other.group)
      }
      if (tile.group) {
        targetGroup = tile.group
      } else if (other.group) {
        targetGroup = other.group
      } else {
        changeData({ maxGroup: puzzle.data.maxGroup + 1 })
        targetGroup = puzzle.data.maxGroup
      }

      changeTile(tile, { group: targetGroup })
      changeTile(other, { group: targetGroup })

      if (searchGroups.length > 0) {
        for (let tmp of puzzle.tiles) {
          if (searchGroups.includes(tmp.group)) {
            changeTile(tmp, { group: targetGroup })
          }
        }
      }
    }

    // determine if two tiles are grouped together
    const areGrouped = (t1, t2) => {
      return t1.group && t1.group === t2.group
    }

    // get the center position of a tile
    const tileCenterPos = (tile) => {
      return tileRectByTile(tile).center()
    }

    // get the would-be visible bounding rect if a tile was
    // in given position
    const tileRectByPos = (pos) => {
      return new BoundingRectangle(
        pos.x,
        pos.x + puzzle.info.tileSize,
        pos.y,
        pos.y + puzzle.info.tileSize
      )
    }

    // get the current visible bounding rect for a tile
    const tileRectByTile = (tile) => {
      return tileRectByPos(tile.pos)
    }

    const tilesSortedByZIndex = () => {
      const sorted = puzzle.tiles.slice()
      return sorted.sort((t1, t2) => t1.z - t2.z)
    }

    const setGroupedZIndex = (tile, zIndex) => {
      for (let t of getGroupedTiles(tile)) {
        changeTile(t, { z: zIndex })
      }
    }

    const setGroupedOwner = (tile, owner) => {
      for (let t of getGroupedTiles(tile)) {
        // may only change own tiles or untaken tiles
        if (t.owner === me || t.owner === 0) {
          changeTile(t, { owner: owner })
        }
      }
    }

    const moveGroupedTilesDiff = (tile, diffX, diffY) => {
      for (let t of getGroupedTiles(tile)) {
        changeTile(t, { pos: pointAdd(t.pos, { x: diffX, y: diffY }) })

        // TODO: instead there could be a function to
        //       get min/max x/y of a group
        updateDrawMinMax(tileCenterPos(t), puzzle.info.tileDrawSize)
      }
    }
    const moveGroupedTiles = (tile, dst) => {
      let diff = pointSub(tile.pos, dst)
      moveGroupedTilesDiff(tile, -diff.x, -diff.y)
    }
    const finishGroupedTiles = (tile) => {
      for (let t of getGroupedTiles(tile)) {
        changeTile(t, {owner: -1, z: 1})
      }
    }
    // ---------------------------------------------------------------







    const onUpdate = () => {
        let last_x = null
        let last_y = null
        // console.log(tp)
        if (EV_DATA.mouse_down_x !== null) {
            last_x = EV_DATA.mouse_down_x
        }
        if (EV_DATA.mouse_down_y !== null) {
            last_y = EV_DATA.mouse_down_y
        }
        for (let mouse of evts.consumeAll()) {
          if (mouse.type === 'move') {
            const tp = cam.translateMouse(mouse)
            changePlayer({x: tp.x, y: tp.y})
            updateDrawMinMax(tp, cursorGrab.width)
            rerenderPlayer = true
          }
          if (mouse.type === 'down') {
            const tp = cam.translateMouse(mouse)
            changePlayer({down: true})
            updateDrawMinMax(tp, cursorGrab.width)
            rerenderPlayer = true
          } else if (mouse.type === 'up') {
            const tp = cam.translateMouse(mouse)
            changePlayer({down: false})
            updateDrawMinMax(tp, cursorGrab.width)
            rerenderPlayer = true
          }
            if (mouse.type === 'wheel') {
                if (mouse.deltaY < 0) {
                    if (cam.zoomIn()) {
                        rerender = true
                        const tp = cam.translateMouse(mouse)
                        changePlayer({x: tp.x, y: tp.y})
                        updateDrawMinMax(tp, cursorGrab.width)
                        rerenderPlayer = true
                    }
                } else {
                    if (cam.zoomOut()) {
                        rerender = true
                        const tp = cam.translateMouse(mouse)
                        changePlayer({x: tp.x, y: tp.y})
                        updateDrawMinMax(tp, cursorGrab.width)
                        rerenderPlayer = true
                    }
                }
            } else if (mouse.type === 'down') {
                EV_DATA.mouse_down_x = mouse.x
                EV_DATA.mouse_down_y = mouse.y
                if (last_x === null || last_y === null) {
                    last_x = mouse.x
                    last_y = mouse.y
                }

                let tp = cam.translateMouse(mouse)
                grabbingTileIdx = unfinishedTileByPos(puzzle, tp)
                console.log(grabbingTileIdx)
                if (grabbingTileIdx >= 0) {
                  changeData({maxZ: puzzle.data.maxZ + 1})
                  setGroupedZIndex(puzzle.tiles[grabbingTileIdx], puzzle.data.maxZ)
                  setGroupedOwner(puzzle.tiles[grabbingTileIdx], me)
                }
                console.log('down', tp)

            } else if (mouse.type === 'up') {
                EV_DATA.mouse_down_x = null
                EV_DATA.mouse_down_y = null
                last_x = null
                last_y === null

                if (grabbingTileIdx >= 0) {
                    // Check if the tile was dropped at the correct
                    // location

                    let tile = puzzle.tiles[grabbingTileIdx]
                    setGroupedOwner(tile, 0)
                    let pt = pointSub(tile.pos, boardPos)
                    let dst = tileRectByPos(pt)
                    let srcRect = srcRectByIdx(puzzle.info, grabbingTileIdx)
                    if (srcRect.centerDistance(dst) < puzzle.info.snapDistance) {
                        // Snap the tile to the final destination
                        console.log('ok! !!!')
                        moveGroupedTiles(tile, new Point(
                            srcRect.x0 + boardPos.x,
                            srcRect.y0 + boardPos.y
                        ))
                        finishGroupedTiles(tile)

                        let tp = cam.translateMouse(mouse)
                        updateDrawMinMax(tp, puzzle.info.tileDrawSize)
                    } else {
                        // Snap to other tiles
                        let other
                        let snapped = false
                        let off
                        let offs = [
                            [0, 1],
                            [-1, 0],
                            [0, -1],
                            [1, 0],
                        ]

                        const check = (t, off, other) => {
                            if (snapped || !other || (other.owner === -1) || areGrouped(t, other)) {
                                return
                            }
                            let trec_ = tileRectByTile(t)
                            let otrec = tileRectByTile(other).moved(
                                off[0] * puzzle.info.tileSize,
                                off[1] * puzzle.info.tileSize
                            )
                            if (trec_.centerDistance(otrec) < puzzle.info.snapDistance) {
                                console.log('yea top!')
                                moveGroupedTiles(t, {x: otrec.x0, y: otrec.y0})
                                groupTiles(t, other)
                                setGroupedZIndex(t, t.z)
                                snapped = true

                                updateDrawMinMax(tileCenterPos(t), puzzle.info.tileDrawSize)
                            }
                        }

                        for (let t of getGroupedTiles(tile)) {
                            let others = getSurroundingTilesByIdx(puzzle, t.idx)

                            // top
                            off = offs[0]
                            other = others[0]
                            check(t, off, other)

                            // right
                            off = offs[1]
                            other = others[1]
                            check(t, off, other)

                            // bottom
                            off = offs[2]
                            other = others[2]
                            check(t, off, other)

                            // left
                            off = offs[3]
                            other = others[3]
                            check(t, off, other)

                            if (snapped) {
                                break
                            }
                        }
                    }
                }
                grabbingTileIdx = -1
                console.log('up', cam.translateMouse(mouse))
            } else if ((EV_DATA.mouse_down_x !== null) && mouse.type === 'move') {
                EV_DATA.mouse_down_x = mouse.x
                EV_DATA.mouse_down_y = mouse.y

                if (last_x === null || last_y === null) {
                    last_x = mouse.x
                    last_y = mouse.y
                }

                if (grabbingTileIdx >= 0) {
                    let tp = cam.translateMouse(mouse)
                    let tp_last = cam.translateMouse({x: last_x, y: last_y})
                    const diffX = tp.x - tp_last.x
                    const diffY = tp.y - tp_last.y

                    let t = puzzle.tiles[grabbingTileIdx]
                    moveGroupedTilesDiff(t, diffX, diffY)

                    // todo: dont +- tileDrawSize, we can work with less
                    updateDrawMinMax(tp, puzzle.info.tileDrawSize)
                    updateDrawMinMax(tp_last, puzzle.info.tileDrawSize)
                } else {
                    const diffX = Math.round(mouse.x - last_x)
                    const diffY = Math.round(mouse.y - last_y)
                    // move the cam
                    cam.move(diffX, diffY)
                    rerender = true
                }
            }
            // console.log(mouse)
        }
        if (redrawMinX) {
            rerenderTableRect = new BoundingRectangle(
                redrawMinX,
                redrawMaxX,
                redrawMinY,
                redrawMaxY
            )
            rerenderTable = true
        }

        if (_STATE_CHANGED) {
          conn.send(JSON.stringify({
            type: 'state',
            state: _STATE,
          }))
          _STATE.changes = []
          _STATE_CHANGED = false
        }
    }

    const onRender = () => {
      if (!rerenderTable && !rerender) {
        return
      }

        console.log('rendering')

        // draw the puzzle table
        if (rerenderTable) {
            fillBitmapCapped(puzzleTable, puzzleTableColor, rerenderTableRect)

            // draw the puzzle board on the table
            mapBitmapToBitmapCapped(board, board.getBoundingRect(), puzzleTable, new BoundingRectangle(
                boardPos.x,
                boardPos.x + board.width - 1,
                boardPos.y,
                boardPos.y + board.height - 1,
            ), rerenderTableRect)

            // draw all the tiles on the table

            for (let tile of tilesSortedByZIndex()) {
                let rect = new BoundingRectangle(
                    puzzle.info.tileDrawOffset + tile.pos.x,
                    puzzle.info.tileDrawOffset + tile.pos.x + puzzle.info.tileDrawSize,
                    puzzle.info.tileDrawOffset + tile.pos.y,
                    puzzle.info.tileDrawOffset + tile.pos.y + puzzle.info.tileDrawSize,
                )
                let bmp = bitmaps[tile.idx]
                mapBitmapToBitmapCapped(
                  bmp,
                  bmp.getBoundingRect(),
                  puzzleTable,
                  rect,
                  rerenderTableRect
                )
            }
        }

        // finally draw the finished table onto the canvas
        // only part of the table may be visible, depending on the
        // camera
        adapter.clear()
        mapBitmapToAdapter(puzzleTable, new BoundingRectangle(
            - cam.x,
            - cam.x + (cam.width / cam.zoom),
            - cam.y,
            - cam.y + (cam.height / cam.zoom),
        ), adapter, adapter.getBoundingRect())


        let cursor = player.down ? cursorGrab : cursorHand
        let back = cam.translateMouseBack(player)
        mapBitmapToAdapter(
          cursor,
          cursor.getBoundingRect(),
          adapter,
          new BoundingRectangle(
            back.x - (cursor.width/2),
            back.x - (cursor.width/2) + cursor.width - 1,
            back.y - (cursor.width/2),
            back.y - (cursor.width/2) + cursor.height - 1,
          )
        )

        rerenderTable = false
        rerenderTableRect = null
        rerender = false
        redrawMinX = null
        redrawMaxX = null
        redrawMinY = null
        redrawMaxY = null
    }

    run({
        update: onUpdate,
        render: onRender,
    })
  }
}

main()
