"use strict"
import CanvasAdapter from './CanvasAdapter.js'
import BoundingRectangle from './BoundingRectangle.js'
import Bitmap from './Bitmap.js'
import {run} from './gameloop.js'
import Camera from './Camera.js'
import EventAdapter from './EventAdapter.js'
import WsClient from './WsClient.js'

if (!GAME_ID) throw '[ GAME_ID not set ]'
if (!WS_ADDRESS) throw '[ WS_ADDRESS not set ]'

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

function fillBitmapCapped(bitmap, rgba, rects_cap) {
  if (!rects_cap) {
    return fillBitmap(bitmap, rgba)
  }
  for (let rect_cap of rects_cap) {
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
}

function mapBitmapToBitmap(
  /** @type {Bitmap} */src,
  /** @type {BoundingRectangle} */ rect_src,
  /** @type {Bitmap} */ dst,
  /** @type {BoundingRectangle} */ rect_dst
) {
  const tmp = new Uint8ClampedArray(4)
  const w_f = rect_src.width / rect_dst.width
  const h_f = rect_src.height / rect_dst.height

  let startX = Math.max(rect_dst.x0, Math.floor((-rect_src.x0 / w_f) + rect_dst.x0))
  let startY = Math.max(rect_dst.y0, Math.floor((-rect_src.y0 / h_f) + rect_dst.y0))

  let endX = Math.min(rect_dst.x1, Math.ceil(((src.width - rect_src.x0) / w_f) + rect_dst.x0))
  let endY = Math.min(rect_dst.y1, Math.ceil(((src.height - rect_src.y0) / h_f) + rect_dst.y0))

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
}

function mapBitmapToBitmapCapped(
  /** @type {Bitmap} */ src,
  /** @type {BoundingRectangle} */ rect_src,
  /** @type {Bitmap} */ dst,
  /** @type {BoundingRectangle} */ rect_dst,
  rects_cap
) {
  if (!rects_cap) {
    return mapBitmapToBitmap(src, rect_src, dst, rect_dst)
  }
  const tmp = new Uint8ClampedArray(4)
  const w_f = rect_src.width / rect_dst.width
  const h_f = rect_src.height / rect_dst.height

  for (let rect_cap of rects_cap) {
    let startX = Math.floor(Math.max(rect_cap.x0, rect_dst.x0, (-rect_src.x0 / w_f) + rect_dst.x0))
    let startY = Math.floor(Math.max(rect_cap.y0, rect_dst.y0, (-rect_src.y0 / h_f) + rect_dst.y0))

    let endX = Math.ceil(Math.min(rect_cap.x1, rect_dst.x1, ((src.width - rect_src.x0) / w_f) + rect_dst.x0))
    let endY = Math.ceil(Math.min(rect_cap.y1, rect_dst.y1, ((src.height - rect_src.y0) / h_f) + rect_dst.y0))

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
  }
}

function mapBitmapToAdapterCapped (
  /** @type {Bitmap} */ src,
  /** @type {BoundingRectangle} */ rect_src,
  /** @type {CanvasAdapter} */ dst,
  /** @type {BoundingRectangle} */ rect_dst,
  rects_cap
) {
  if (!rects_cap) {
    return mapBitmapToAdapter(src, rect_src, dst, rect_dst)
  }
  const tmp = new Uint8ClampedArray(4)
  const w_f = rect_src.width / rect_dst.width
  const h_f = rect_src.height / rect_dst.height

  for (let rect_cap of rects_cap) {
    let startX = Math.floor(Math.max(rect_cap.x0, rect_dst.x0, (-rect_src.x0 / w_f) + rect_dst.x0))
    let startY = Math.floor(Math.max(rect_cap.y0, rect_dst.y0, (-rect_src.y0 / h_f) + rect_dst.y0))

    let endX = Math.ceil(Math.min(rect_cap.x1, rect_dst.x1, ((src.width - rect_src.x0) / w_f) + rect_dst.x0))
    let endY = Math.ceil(Math.min(rect_cap.y1, rect_dst.y1, ((src.height - rect_src.y0) / h_f) + rect_dst.y0))

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
  }
}

function mapBitmapToAdapter(
  /** @type {Bitmap} */ src,
  /** @type {BoundingRectangle} */ rect_src,
  /** @type {CanvasAdapter} */ dst,
  /** @type {BoundingRectangle} */ rect_dst
) {
  const tmp = new Uint8ClampedArray(4)
  const w_f = rect_src.width / rect_dst.width
  const h_f = rect_src.height / rect_dst.height

  let startX = Math.max(rect_dst.x0, Math.floor((-rect_src.x0 / w_f) + rect_dst.x0))
  let startY = Math.max(rect_dst.y0, Math.floor((-rect_src.y0 / h_f) + rect_dst.y0))

  let endX = Math.min(rect_dst.x1, Math.ceil(((src.width - rect_src.x0) / w_f) + rect_dst.x0))
  let endY = Math.min(rect_dst.y1, Math.ceil(((src.height - rect_src.y0) / h_f) + rect_dst.y0))

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

function canvasToBitmap(
  /** @type {HTMLCanvasElement} */ c,
  /** @type {CanvasRenderingContext2D} */ ctx
) {
  const data = ctx.getImageData(0, 0, c.width, c.height).data
  return dataToBitmap(c.width, c.height, data)
}

function imageToBitmap(img) {
  const c = createCanvas(img.width, img.height)
  const ctx = c.getContext('2d')
  ctx.drawImage(img, 0, 0)
  return canvasToBitmap(c, ctx)
}

async function loadImageToBitmap(imagePath) {
  console.log(imagePath)
  const img = new Image()
  await new Promise((resolve) => {
    img.onload = resolve
    img.src = imagePath
  });
  return imageToBitmap(img)
}

function pointInBounds(pt, rect) {
  return pt.x >= rect.x0
    && pt.x <= rect.x1
    && pt.y >= rect.y0
    && pt.y <= rect.y1
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

async function createPuzzleTileBitmaps(bitmap, tiles, info) {
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

  const paths = {}
  function pathForShape(shape) {
    const key = `${shape.top}${shape.right}${shape.left}${shape.bottom}`
    if (paths[key]) {
      return paths[key]
    }

    const path = new Path2D()
    const topLeftEdge = { x: tileMarginWidth, y: tileMarginWidth }
    path.moveTo(topLeftEdge.x, topLeftEdge.y)
    for (let i = 0; i < curvyCoords.length / 6; i++) {
      const p1 = pointAdd(topLeftEdge, { x: curvyCoords[i * 6 + 0] * tileRatio, y: shape.top * curvyCoords[i * 6 + 1] * tileRatio })
      const p2 = pointAdd(topLeftEdge, { x: curvyCoords[i * 6 + 2] * tileRatio, y: shape.top * curvyCoords[i * 6 + 3] * tileRatio })
      const p3 = pointAdd(topLeftEdge, { x: curvyCoords[i * 6 + 4] * tileRatio, y: shape.top * curvyCoords[i * 6 + 5] * tileRatio })
      path.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
    }
    const topRightEdge = pointAdd(topLeftEdge, { x: tileSize, y: 0 })
    for (let i = 0; i < curvyCoords.length / 6; i++) {
      const p1 = pointAdd(topRightEdge, { x: -shape.right * curvyCoords[i * 6 + 1] * tileRatio, y: curvyCoords[i * 6 + 0] * tileRatio })
      const p2 = pointAdd(topRightEdge, { x: -shape.right * curvyCoords[i * 6 + 3] * tileRatio, y: curvyCoords[i * 6 + 2] * tileRatio })
      const p3 = pointAdd(topRightEdge, { x: -shape.right * curvyCoords[i * 6 + 5] * tileRatio, y: curvyCoords[i * 6 + 4] * tileRatio })
      path.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
    }
    const bottomRightEdge = pointAdd(topRightEdge, { x: 0, y: tileSize })
    for (let i = 0; i < curvyCoords.length / 6; i++) {
      let p1 = pointSub(bottomRightEdge, { x: curvyCoords[i * 6 + 0] * tileRatio, y: shape.bottom * curvyCoords[i * 6 + 1] * tileRatio })
      let p2 = pointSub(bottomRightEdge, { x: curvyCoords[i * 6 + 2] * tileRatio, y: shape.bottom * curvyCoords[i * 6 + 3] * tileRatio })
      let p3 = pointSub(bottomRightEdge, { x: curvyCoords[i * 6 + 4] * tileRatio, y: shape.bottom * curvyCoords[i * 6 + 5] * tileRatio })
      path.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
    }
    const bottomLeftEdge = pointSub(bottomRightEdge, { x: tileSize, y: 0 })
    for (let i = 0; i < curvyCoords.length / 6; i++) {
      let p1 = pointSub(bottomLeftEdge, { x: -shape.left * curvyCoords[i * 6 + 1] * tileRatio, y: curvyCoords[i * 6 + 0] * tileRatio })
      let p2 = pointSub(bottomLeftEdge, { x: -shape.left * curvyCoords[i * 6 + 3] * tileRatio, y: curvyCoords[i * 6 + 2] * tileRatio })
      let p3 = pointSub(bottomLeftEdge, { x: -shape.left * curvyCoords[i * 6 + 5] * tileRatio, y: curvyCoords[i * 6 + 4] * tileRatio })
      path.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
    }
    paths[key] = path
    return path
  }

  for (let tile of tiles) {
    const srcRect = srcRectByIdx(info, tile.idx)
    const path = pathForShape(info.shapes[tile.idx])

    const c = createCanvas(tileDrawSize, tileDrawSize)
    const ctx = c.getContext('2d')
    // -----------------------------------------------------------
    // -----------------------------------------------------------
    ctx.lineWidth = 2
    ctx.stroke(path)
    // -----------------------------------------------------------
    // -----------------------------------------------------------
    ctx.save();
    ctx.clip(path)
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
    ctx.stroke(path)
    ctx.restore();

    const bitmap = canvasToBitmap(c, ctx)

    bitmaps[tile.idx] = bitmap
  }

  return bitmaps
}

function srcRectByIdx(puzzleInfo, idx) {
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

const pointSub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y })

const pointAdd = (a, b) => ({x: a.x + b.x, y: a.y + b.y})

// Returns the index of the puzzle tile with the highest z index
// that is not finished yet and that matches the position
const unfinishedTileByPos = (puzzle, pos) => {
  let maxZ = -1
  let tileIdx = -1
  for (let idx = 0; idx < puzzle.tiles.length; idx++) {
    const tile = puzzle.tiles[idx]
    if (tile.owner === -1) {
      continue
    }

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
  const bmp = await loadImageToBitmap(puzzle.info.imageUrl)

  // creation of tile bitmaps
  // then create the final puzzle bitmap
  // NOTE: this can decrease OR increase in size!
  const bmpResized = resizeBitmap(bmp, puzzle.info.width, puzzle.info.height)
  return await createPuzzleTileBitmaps(bmpResized, puzzle.tiles, puzzle.info)
}

function uniqId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2)
}

function initme() {
  // return uniqId()
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
  let gameId = GAME_ID // uniqId()
  let me = initme()

  let cursorGrab = await loadImageToBitmap('/grab.png')
  let cursorHand = await loadImageToBitmap('/hand.png')

  let conn = setupNetwork(me + '|' + gameId)
  conn.send(JSON.stringify({ type: 'init' }))
  conn.onSocket('message', async ({data}) => {
    const d = JSON.parse(data)
    if (d.type === 'init') {
      console.log('the game ', d.game)
      let bitmaps = await loadPuzzleBitmaps(d.game.puzzle)
      startGame(d.game, bitmaps, conn)
    } else {
      // console.log(d)
    }
  })

  const _STATE = {
    changes: [],
  }
  let _STATE_CHANGED = false

  // this must be fetched from server

  class renderRect {
    constructor() {
      this.reset()
    }
    get () {
      return this.x0 === null ? null : [
        {x0: this.x0, x1: this.x1, y0: this.y0, y1: this.y1}
      ]
      // return this._rects.length === 0 ? null : this._rects
    }
    add (pos, offset) {
      const x0 = pos.x - offset
      const x1 = pos.x + offset
      const y0 = pos.y - offset
      const y1 = pos.y + offset
      this.x0 = this.x0 === null ? x0 : Math.min(this.x0, x0)
      this.x1 = this.x1 === null ? x1 : Math.max(this.x1, x1)
      this.y0 = this.y0 === null ? y0 : Math.min(this.y0, y0)
      this.y1 = this.y1 === null ? y1 : Math.max(this.y1, y1)
      // this._rects.push({ x0, x1, y0, y1 })
    }
    reset () {
      // this._rects = []
      this.x0 = null
      this.x1 = null
      this.y0 = null
      this.y1 = null
    }
  }

  const startGame = (game, bitmaps, conn) => {
    let puzzle = game.puzzle
    let players = game.players
    // information for next render cycle
    let rectPlayer = new renderRect()
    let rerenderPlayer = true
    let rectTable = new renderRect()
    let rerenderTable = true
    let rerender = true

    const changePlayer = (change) => {
      for (let k of Object.keys(change)) {
        players[me][k] = change[k]
      }
      _STATE.changes.push({type: 'change_player', player: players[me]})
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

    conn.onSocket('message', ({data}) => {
      const d = JSON.parse(data)
      if (d.type === 'state_changed' && d.origin !== me) {
        for (let change of d.changes) {
          switch (change.type) {
            case 'change_player': {
              if (players[change.player.id]) {
                rectPlayer.add(cam.translateMouseBack(players[change.player.id]), cursorGrab.width)
              }

              players[change.player.id] = change.player

              rectPlayer.add(cam.translateMouseBack(players[change.player.id]), cursorGrab.width)
            } break;

            case 'change_tile': {
              rectTable.add(puzzle.tiles[change.tile.idx].pos, puzzle.info.tileDrawSize)

              puzzle.tiles[change.tile.idx] = change.tile

              rectTable.add(puzzle.tiles[change.tile.idx].pos, puzzle.info.tileDrawSize)
            } break;
            case 'change_data': {
              puzzle.data = change.data
            } break;
          }
        }
      }
    })

    // Information about what tile is the player currently grabbing
    let grabbingTileIdx = -1

    // The actual place for the puzzle. The tiles may
    // not be moved around infinitely, just on the (invisible)
    // puzzle table. however, the camera may move away from the table
    const puzzleTableColor = [40, 40, 40, 0]
    const puzzleTable = new Bitmap(
      puzzle.info.table.width,
      puzzle.info.table.height,
      puzzleTableColor
    )

    // In the middle of the table, there is a board. this is to
    // tell the player where to place the final puzzle
    const boardColor = [80, 80, 80, 255]
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
        rectTable.add(tileCenterPos(t), puzzle.info.tileDrawSize)
      }
    }
    const moveGroupedTiles = (tile, dst) => {
      let diff = pointSub(tile.pos, dst)
      moveGroupedTilesDiff(tile, -diff.x, -diff.y)
    }
    const finishGroupedTiles = (tile) => {
      for (let t of getGroupedTiles(tile)) {
        changeTile(t, { owner: -1, z: 1 })
      }
    }
    // ---------------------------------------------------------------







    let _last_mouse = null
    let _last_mouse_down = null
    const onUpdate = () => {
      let last_x = null
      let last_y = null

      if (_last_mouse_down !== null) {
        last_x = _last_mouse_down.x
        last_y = _last_mouse_down.y
      }
      for (let mouse of evts.consumeAll()) {

        if (mouse.type === 'move') {
          const tp = cam.translateMouse(mouse)
          changePlayer({ x: tp.x, y: tp.y })
          if (_last_mouse) {
            rectPlayer.add(_last_mouse, cursorGrab.width)
          }
          rectPlayer.add(mouse, cursorGrab.width)
        }

        if (mouse.type === 'down') {
          changePlayer({ down: true })
          rectPlayer.add(mouse, cursorGrab.width)
        } else if (mouse.type === 'up') {
          changePlayer({ down: false })
          if (_last_mouse) {
            rectPlayer.add(_last_mouse, cursorGrab.width)
          }
          rectPlayer.add(mouse, cursorGrab.width)
        }

        if (mouse.type === 'wheel') {
          if (mouse.deltaY < 0) {
            if (cam.zoomIn()) {
              rerender = true
              const tp = cam.translateMouse(mouse)
              changePlayer({ x: tp.x, y: tp.y })
              if (_last_mouse) {
                rectPlayer.add(_last_mouse, cursorGrab.width)
              }
              rectPlayer.add(mouse, cursorGrab.width)
            }
          } else {
            if (cam.zoomOut()) {
              rerender = true
              const tp = cam.translateMouse(mouse)
              changePlayer({ x: tp.x, y: tp.y })
              if (_last_mouse) {
                rectPlayer.add(_last_mouse, cursorGrab.width)
              }
              rectPlayer.add(mouse, cursorGrab.width)
            }
          }
        } else if (mouse.type === 'down') {
          _last_mouse_down = mouse
          if (last_x === null || last_y === null) {
            last_x = mouse.x
            last_y = mouse.y
          }

          let tp = cam.translateMouse(mouse)
          grabbingTileIdx = unfinishedTileByPos(puzzle, tp)
          console.log(grabbingTileIdx)
          if (grabbingTileIdx >= 0) {
            changeData({ maxZ: puzzle.data.maxZ + 1 })
            setGroupedZIndex(puzzle.tiles[grabbingTileIdx], puzzle.data.maxZ)
            setGroupedOwner(puzzle.tiles[grabbingTileIdx], me)
          }
          console.log('down', tp)

        } else if (mouse.type === 'up') {
          _last_mouse_down = null
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
              moveGroupedTiles(tile, {
                x: srcRect.x0 + boardPos.x,
                y: srcRect.y0 + boardPos.y,
              })
              finishGroupedTiles(tile)

              let tp = cam.translateMouse(mouse)
              rectTable.add(tp, puzzle.info.tileDrawSize)
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
                  moveGroupedTiles(t, { x: otrec.x0, y: otrec.y0 })
                  groupTiles(t, other)
                  setGroupedZIndex(t, t.z)
                  snapped = true

                  rectTable.add(tileCenterPos(t), puzzle.info.tileDrawSize)
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
        } else if (_last_mouse_down !== null && mouse.type === 'move') {
          _last_mouse_down = mouse

          if (last_x === null || last_y === null) {
            last_x = mouse.x
            last_y = mouse.y
          }

          if (grabbingTileIdx >= 0) {
            let tp = cam.translateMouse(mouse)
            let tp_last = cam.translateMouse({ x: last_x, y: last_y })
            const diffX = tp.x - tp_last.x
            const diffY = tp.y - tp_last.y

            let t = puzzle.tiles[grabbingTileIdx]
            moveGroupedTilesDiff(t, diffX, diffY)

            // todo: dont +- tileDrawSize, we can work with less?
            rectTable.add(tp, puzzle.info.tileDrawSize)
            rectTable.add(tp_last, puzzle.info.tileDrawSize)
          } else {
            const diffX = Math.round(mouse.x - last_x)
            const diffY = Math.round(mouse.y - last_y)
            // move the cam
            cam.move(diffX, diffY)
            rerender = true
          }
        }
        // console.log(mouse)
        _last_mouse = mouse
      }
      if (rectTable.get()) {
        rerenderTable = true
      }
      if (rectPlayer.get()) {
        rerenderPlayer = true
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


    // helper for measuring performance
    let _pt = 0
    let _mindiff = 0
    const checkpoint_start = (mindiff) => {
      _pt = performance.now()
      _mindiff = mindiff
    }
    const checkpoint = (n) => {
      const now = performance.now();
      const diff = now - _pt
      if (diff > _mindiff) {
        console.log(n + ': ' + (diff));
      }
      _pt = now;
    }

    // TODO:
    // try out layered rendering and see
    // if it improves performance:
    //   1. background
    //   2. tiles
    //   3. (moving tiles)
    //   4. (players)
    // (currently, if a player moves, everthing needs to be
    //  rerendered at that position manually, maybe it is faster
    //  when using layers)
    const onRender = () => {
      if (!rerenderTable && !rerenderPlayer && !rerender) {
        return
      }

      checkpoint_start(20)

      // draw the puzzle table
      if (rerenderTable) {

        fillBitmapCapped(puzzleTable, puzzleTableColor, rectTable.get())
        checkpoint('after fill')

        // draw the puzzle board on the table
        mapBitmapToBitmapCapped(board, board.getBoundingRect(), puzzleTable, new BoundingRectangle(
          boardPos.x,
          boardPos.x + board.width - 1,
          boardPos.y,
          boardPos.y + board.height - 1,
        ), rectTable.get())
        checkpoint('imgtoimg')

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
            rectTable.get()
          )
        }
        checkpoint('tiles')
      }

      if (rerenderTable || rerender) {
        // finally draw the finished table onto the canvas
        // only part of the table may be visible, depending on the
        // camera
        adapter.clear()
        adapter.apply()
        checkpoint('afterclear_1')

        // TODO: improve the rendering
        // atm it is pretty slow (~40-50ms)
        mapBitmapToAdapter(
          puzzleTable,
          cam.rect(),
          adapter,
          adapter.getBoundingRect()
        )
        checkpoint('to_adapter_1')
      } else if (rerenderPlayer) {
        adapter.clearRect(rectPlayer.get())
        checkpoint('afterclear_2')
        mapBitmapToAdapterCapped(
          puzzleTable,
          cam.rect(),
          adapter,
          adapter.getBoundingRect(),
          rectPlayer.get()
        )
        checkpoint('to_adapter_2')
      }

      if (rerenderPlayer) {
        for (let id of Object.keys(players)) {
          let p = players[id]
          let cursor = p.down ? cursorGrab : cursorHand
          let back = cam.translateMouseBack(p)
          mapBitmapToAdapter(
            cursor,
            cursor.getBoundingRect(),
            adapter,
            new BoundingRectangle(
              back.x - (cursor.width / 2),
              back.x - (cursor.width / 2) + cursor.width - 1,
              back.y - (cursor.width / 2),
              back.y - (cursor.width / 2) + cursor.height - 1,
            )
          )
        }
        checkpoint('after_players')
      }

      adapter.apply()
      checkpoint('finals')

      rerenderTable = false
      rerenderPlayer = false
      rerender = false
      rectTable.reset()
      rectPlayer.reset()
    }

    run({
      update: onUpdate,
      render: onRender,
    })
  }
}

main()
