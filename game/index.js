"use strict"
import {run} from './gameloop.js'
import Camera from './Camera.js'
import EventAdapter from './EventAdapter.js'
import Graphics from './Graphics.js'
import Debug from './Debug.js'
import Communication from './Communication.js'
import Geometry from './../common/Geometry.js'

if (typeof GAME_ID === 'undefined') throw '[ GAME_ID not set ]'
if (typeof WS_ADDRESS === 'undefined') throw '[ WS_ADDRESS not set ]'

if (typeof DEBUG === 'undefined') window.DEBUG = false

function addCanvasToDom(canvas) {
    document.body.append(canvas)
    return canvas
}

async function createPuzzleTileBitmaps(img, tiles, info) {
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
      const p1 = Geometry.pointAdd(topLeftEdge, { x: curvyCoords[i * 6 + 0] * tileRatio, y: shape.top * curvyCoords[i * 6 + 1] * tileRatio })
      const p2 = Geometry.pointAdd(topLeftEdge, { x: curvyCoords[i * 6 + 2] * tileRatio, y: shape.top * curvyCoords[i * 6 + 3] * tileRatio })
      const p3 = Geometry.pointAdd(topLeftEdge, { x: curvyCoords[i * 6 + 4] * tileRatio, y: shape.top * curvyCoords[i * 6 + 5] * tileRatio })
      path.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
    }
    const topRightEdge = Geometry.pointAdd(topLeftEdge, { x: tileSize, y: 0 })
    for (let i = 0; i < curvyCoords.length / 6; i++) {
      const p1 = Geometry.pointAdd(topRightEdge, { x: -shape.right * curvyCoords[i * 6 + 1] * tileRatio, y: curvyCoords[i * 6 + 0] * tileRatio })
      const p2 = Geometry.pointAdd(topRightEdge, { x: -shape.right * curvyCoords[i * 6 + 3] * tileRatio, y: curvyCoords[i * 6 + 2] * tileRatio })
      const p3 = Geometry.pointAdd(topRightEdge, { x: -shape.right * curvyCoords[i * 6 + 5] * tileRatio, y: curvyCoords[i * 6 + 4] * tileRatio })
      path.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
    }
    const bottomRightEdge = Geometry.pointAdd(topRightEdge, { x: 0, y: tileSize })
    for (let i = 0; i < curvyCoords.length / 6; i++) {
      let p1 = Geometry.pointSub(bottomRightEdge, { x: curvyCoords[i * 6 + 0] * tileRatio, y: shape.bottom * curvyCoords[i * 6 + 1] * tileRatio })
      let p2 = Geometry.pointSub(bottomRightEdge, { x: curvyCoords[i * 6 + 2] * tileRatio, y: shape.bottom * curvyCoords[i * 6 + 3] * tileRatio })
      let p3 = Geometry.pointSub(bottomRightEdge, { x: curvyCoords[i * 6 + 4] * tileRatio, y: shape.bottom * curvyCoords[i * 6 + 5] * tileRatio })
      path.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
    }
    const bottomLeftEdge = Geometry.pointSub(bottomRightEdge, { x: tileSize, y: 0 })
    for (let i = 0; i < curvyCoords.length / 6; i++) {
      let p1 = Geometry.pointSub(bottomLeftEdge, { x: -shape.left * curvyCoords[i * 6 + 1] * tileRatio, y: curvyCoords[i * 6 + 0] * tileRatio })
      let p2 = Geometry.pointSub(bottomLeftEdge, { x: -shape.left * curvyCoords[i * 6 + 3] * tileRatio, y: curvyCoords[i * 6 + 2] * tileRatio })
      let p3 = Geometry.pointSub(bottomLeftEdge, { x: -shape.left * curvyCoords[i * 6 + 5] * tileRatio, y: curvyCoords[i * 6 + 4] * tileRatio })
      path.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
    }
    paths[key] = path
    return path
  }

  for (let tile of tiles) {
    const srcRect = srcRectByIdx(info, tile.idx)
    const path = pathForShape(info.shapes[tile.idx])

    const c = Graphics.createCanvas(tileDrawSize, tileDrawSize)
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
      srcRect.x - tileMarginWidth,
      srcRect.y - tileMarginWidth,
      tileDrawSize,
      tileDrawSize,
      0,
      0,
      tileDrawSize,
      tileDrawSize,
    )
    ctx.stroke(path)
    ctx.restore();

    bitmaps[tile.idx] = await createImageBitmap(c)
  }

  return bitmaps
}

function srcRectByIdx(puzzleInfo, idx) {
  let c = puzzleInfo.coords[idx]
  let cx = c.x * puzzleInfo.tileSize
  let cy = c.y * puzzleInfo.tileSize
  return {
    x: cx,
    y: cy,
    w: puzzleInfo.tileSize,
    h: puzzleInfo.tileSize,
  }
}

async function loadPuzzleBitmaps(puzzle) {
  // load bitmap, to determine the original size of the image
  const bmp = await Graphics.loadImageToBitmap(puzzle.info.imageUrl)

  // creation of tile bitmaps
  // then create the final puzzle bitmap
  // NOTE: this can decrease OR increase in size!
  const bmpResized = await Graphics.resizeBitmap(bmp, puzzle.info.width, puzzle.info.height)
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

const getFirstOwnedTile = (puzzle, userId) => {
  for (let t of puzzle.tiles) {
    if (t.owner === userId) {
      return t
    }
  }
  return null
}

async function main () {
  let gameId = GAME_ID
  let me = initme()

  let cursorGrab = await Graphics.loadImageToBitmap('/grab.png')
  let cursorHand = await Graphics.loadImageToBitmap('/hand.png')

  const game = await Communication.connect(gameId, me)

  const bitmaps = await loadPuzzleBitmaps(game.puzzle)
  const puzzle = game.puzzle
  const players = game.players

  let rerender = true

  const changePlayer = (change) => {
    for (let k of Object.keys(change)) {
      players[me][k] = change[k]
    }
  }

  // Create a dom and attach adapters to it so we can work with it
  const canvas = addCanvasToDom(Graphics.createCanvas())
  const ctx = canvas.getContext('2d')
  const evts = new EventAdapter(canvas)

  // initialize some view data
  // this global data will change according to input events
  const viewport = new Camera(canvas)
  // center viewport
  viewport.move(
    -(puzzle.info.table.width - viewport.width) /2,
    -(puzzle.info.table.height - viewport.height) /2
  )

  Communication.onChanges((changes) => {
    for (let [type, typeData] of changes) {
      switch (type) {
        case 'player': {
          if (typeData.id !== me) {
            players[typeData.id] = typeData
            rerender = true
          }
        } break;
        case 'tile': {
          puzzle.tiles[typeData.idx] = typeData
          rerender = true
        } break;
        case 'data': {
          puzzle.data = typeData
          rerender = true
        } break;
      }
    }
  })

  // In the middle of the table, there is a board. this is to
  // tell the player where to place the final puzzle
  const boardColor = '#505050'

  const tilesSortedByZIndex = () => {
    const sorted = puzzle.tiles.slice()
    return sorted.sort((t1, t2) => t1.z - t2.z)
  }


  let _last_mouse_down = null
  const onUpdate = () => {
    for (let mouse of evts.consumeAll()) {
      const tp = viewport.viewportToWorld(mouse)

      if (mouse.type === 'move') {
        Communication.addMouse(['move', tp.x, tp.y])
        rerender = true
        changePlayer({ x: tp.x, y: tp.y })

        if (_last_mouse_down && !getFirstOwnedTile(puzzle, me)) {
            // move the cam
            const diffX = Math.round(mouse.x - _last_mouse_down.x)
            const diffY = Math.round(mouse.y - _last_mouse_down.y)
            viewport.move(diffX, diffY)

            _last_mouse_down = mouse
        }
      } else if (mouse.type === 'down') {
        Communication.addMouse(['down', tp.x, tp.y])
        _last_mouse_down = mouse
      } else if (mouse.type === 'up') {
        Communication.addMouse(['up', tp.x, tp.y])
        _last_mouse_down = null
      } else if (mouse.type === 'wheel') {
        if (
          mouse.deltaY < 0 && viewport.zoomIn()
          || mouse.deltaY > 0 && viewport.zoomOut()
        ) {
          rerender = true
          changePlayer({ x: tp.x, y: tp.y })
        }
      }
    }
  }

  const onRender = () => {
    if (!rerender) {
      return
    }

    let pos
    let dim

    if (DEBUG) Debug.checkpoint_start(0)

    // CLEAR CTX
    // ---------------------------------------------------------------
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (DEBUG) Debug.checkpoint('clear done')
    // ---------------------------------------------------------------


    // DRAW BOARD
    // ---------------------------------------------------------------
    pos = viewport.worldToViewport({
      x: (puzzle.info.table.width - puzzle.info.width) / 2,
      y: (puzzle.info.table.height - puzzle.info.height) / 2
    })
    dim = viewport.worldDimToViewport({
      w: puzzle.info.width,
      h: puzzle.info.height,
    })
    ctx.fillStyle = boardColor
    ctx.fillRect(pos.x, pos.y, dim.w, dim.h)
    if (DEBUG) Debug.checkpoint('board done')
    // ---------------------------------------------------------------


    // DRAW TILES
    // ---------------------------------------------------------------
    for (let tile of tilesSortedByZIndex()) {
      const bmp = bitmaps[tile.idx]
      pos = viewport.worldToViewport({
        x: puzzle.info.tileDrawOffset + tile.pos.x,
        y: puzzle.info.tileDrawOffset + tile.pos.y,
      })
      dim = viewport.worldDimToViewport({
        w: puzzle.info.tileDrawSize,
        h: puzzle.info.tileDrawSize,
      })
      ctx.drawImage(bmp,
        0, 0, bmp.width, bmp.height,
        pos.x, pos.y, dim.w, dim.h
      )
    }
    if (DEBUG) Debug.checkpoint('tiles done')
    // ---------------------------------------------------------------


    // DRAW PLAYERS
    // ---------------------------------------------------------------
    for (let id of Object.keys(players)) {
      const p = players[id]
      const cursor = p.down ? cursorGrab : cursorHand
      const pos = viewport.worldToViewport(p)
      ctx.drawImage(cursor,
        Math.round(pos.x - cursor.width/2),
        Math.round(pos.y - cursor.height/2)
      )
    }
    if (DEBUG) Debug.checkpoint('players done')
    // ---------------------------------------------------------------


    rerender = false
  }

  run({
    update: onUpdate,
    render: onRender,
  })
}

main()
