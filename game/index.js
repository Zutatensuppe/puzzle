"use strict"
import {run} from './gameloop.js'
import Camera from './Camera.js'
import Graphics from './Graphics.js'
import Debug from './Debug.js'
import Communication from './Communication.js'
import Util from './../common/Util.js'
import PuzzleGraphics from './PuzzleGraphics.js'
import Game from './Game.js'

if (typeof GAME_ID === 'undefined') throw '[ GAME_ID not set ]'
if (typeof WS_ADDRESS === 'undefined') throw '[ WS_ADDRESS not set ]'

if (typeof DEBUG === 'undefined') window.DEBUG = false

function addCanvasToDom(canvas) {
    document.body.append(canvas)
    return canvas
}

function initme() {
  // return uniqId()
  let ID = localStorage.getItem("ID")
  if (!ID) {
    ID = Util.uniqId()
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

export default class EventAdapter {
  constructor(canvas, viewport) {
    this._mouseEvts = []
    this._viewport = viewport
    canvas.addEventListener('mousedown', this._mouseDown.bind(this))
    canvas.addEventListener('mouseup', this._mouseUp.bind(this))
    canvas.addEventListener('mousemove', this._mouseMove.bind(this))
    canvas.addEventListener('wheel', this._wheel.bind(this))
  }

  consumeAll() {
    if (this._mouseEvts.length === 0) {
      return []
    }
    const all = this._mouseEvts.slice()
    this._mouseEvts = []
    return all
  }

  _mouseDown(e) {
    if (e.button === 0) {
      const pos = this._viewport.viewportToWorld({
        x: e.offsetX,
        y: e.offsetY,
      })
      this._mouseEvts.push(['down', pos.x, pos.y])
    }
  }

  _mouseUp(e) {
    if (e.button === 0) {
      const pos = this._viewport.viewportToWorld({
        x: e.offsetX,
        y: e.offsetY,
      })
      this._mouseEvts.push(['up', pos.x, pos.y])
    }
  }

  _mouseMove(e) {
    const pos = this._viewport.viewportToWorld({
      x: e.offsetX,
      y: e.offsetY,
    })
    this._mouseEvts.push(['move', pos.x, pos.y])
  }

  _wheel(e) {
    const pos = this._viewport.viewportToWorld({
      x: e.offsetX,
      y: e.offsetY,
    })
    const evt = e.deltaY < 0 ? 'zoomin' : 'zoomout'
    this._mouseEvts.push([evt, pos.x, pos.y])
  }
}

async function main() {
  let gameId = GAME_ID
  let CLIENT_ID = initme()

  let cursorGrab = await Graphics.loadImageToBitmap('/grab.png')
  let cursorHand = await Graphics.loadImageToBitmap('/hand.png')

  const game = await Communication.connect(gameId, CLIENT_ID)
  Game.createGame(GAME_ID, game);

  const bitmaps = await PuzzleGraphics.loadPuzzleBitmaps(game.puzzle)
  const puzzle = game.puzzle
  const players = game.players

  let rerender = true

  const changePlayer = (change) => {
    for (let k of Object.keys(change)) {
      players[CLIENT_ID][k] = change[k]
    }
  }

  // Create a dom and attach adapters to it so we can work with it
  const canvas = addCanvasToDom(Graphics.createCanvas())
  const ctx = canvas.getContext('2d')

  // initialize some view data
  // this global data will change according to input events
  const viewport = new Camera(canvas)
  // center viewport
  viewport.move(
    -(puzzle.info.table.width - viewport.width) /2,
    -(puzzle.info.table.height - viewport.height) /2
  )

  const evts = new EventAdapter(canvas, viewport)

  Communication.onServerChange((msg) => {
    const msgType = msg[0]
    const evClientId = msg[1]
    const evClientSeq = msg[2]
    const evChanges = msg[3]
    for(let [changeType, changeData] of evChanges) {
      switch (changeType) {
        case 'player': {
          if (changeData.id !== CLIENT_ID) {
            players[changeData.id] = changeData
            rerender = true
          }
        } break;
        case 'tile': {
          puzzle.tiles[changeData.idx] = changeData
          rerender = true
        } break;
        case 'data': {
          puzzle.data = changeData
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
    for (let evt of evts.consumeAll()) {

      // LOCAL ONLY CHANGES
      // -------------------------------------------------------------
      const type = evt[0]
      const pos = {x: evt[1], y: evt[2]}
      if (type === 'move') {
        rerender = true
        changePlayer(pos)

        if (_last_mouse_down && !getFirstOwnedTile(puzzle, CLIENT_ID)) {
            // move the cam
            const mouse = viewport.worldToViewport(pos)
            const diffX = Math.round(mouse.x - _last_mouse_down.x)
            const diffY = Math.round(mouse.y - _last_mouse_down.y)
            viewport.move(diffX, diffY)

            _last_mouse_down = mouse
        }
      } else if (type === 'down') {
        _last_mouse_down = viewport.worldToViewport(pos)
      } else if (type === 'up') {
        _last_mouse_down = null
      } else if (type === 'zoomin') {
        if (viewport.zoomIn()) {
          rerender = true
          changePlayer(pos)
        }
      } else if (type === 'zoomout') {
        if (viewport.zoomOut()) {
          rerender = true
          changePlayer(pos)
        }
      }

      // LOCAL + SERVER CHANGES
      // -------------------------------------------------------------
      Game.handleInput(GAME_ID, CLIENT_ID, evt)
      Communication.sendClientEvent(evt)
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
