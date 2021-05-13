"use strict"

import {run} from './gameloop.js'
import Camera from './Camera.js'
import Graphics from './Graphics.js'
import Debug from './Debug.js'
import Communication from './Communication.js'
import Util from './../common/Util.js'
import PuzzleGraphics from './PuzzleGraphics.js'
import Game from './../common/GameCommon.js'
import fireworksController from './Fireworks.js'
import Protocol from '../common/Protocol.js'
import Time from '../common/Time.js'

export const MODE_PLAY = 'play'
export const MODE_REPLAY = 'replay'

let PIECE_VIEW_FIXED = true
let PIECE_VIEW_LOOSE = true

const shouldDrawPiece = (piece) => {
  if (piece.owner === -1) {
    return PIECE_VIEW_FIXED
  }
  return PIECE_VIEW_LOOSE
}

let RERENDER = true

function addCanvasToDom(TARGET_EL, canvas) {
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  TARGET_EL.appendChild(canvas)
  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    RERENDER = true
  })
  return canvas
}

function EventAdapter (canvas, window, viewport) {
  let events = []

  let KEYS_ON = true

  let LEFT = false
  let RIGHT = false
  let UP = false
  let DOWN = false
  let ZOOM_IN = false
  let ZOOM_OUT = false
  let SHIFT = false

  const toWorldPoint = (x, y) => {
    const pos = viewport.viewportToWorld({x, y})
    return [pos.x, pos.y]
  }

  const mousePos = (ev) => toWorldPoint(ev.offsetX, ev.offsetY)
  const canvasCenter = () => toWorldPoint(canvas.width / 2, canvas.height / 2)

  const key = (state, ev) => {
    if (!KEYS_ON) {
      return
    }
    if (ev.key === 'Shift') {
      SHIFT = state
    } else if (ev.key === 'ArrowUp' || ev.key === 'w' || ev.key === 'W') {
      UP = state
    } else if (ev.key === 'ArrowDown' || ev.key === 's' || ev.key === 'S') {
      DOWN = state
    } else if (ev.key === 'ArrowLeft' || ev.key === 'a' || ev.key === 'A') {
      LEFT = state
    } else if (ev.key === 'ArrowRight' || ev.key === 'd' || ev.key === 'D') {
      RIGHT = state
    } else if (ev.key === 'q') {
      ZOOM_OUT = state
    } else if (ev.key === 'e') {
      ZOOM_IN = state
    }
  }

  canvas.addEventListener('mousedown', (ev) => {
    if (ev.button === 0) {
      addEvent([Protocol.INPUT_EV_MOUSE_DOWN, ...mousePos(ev)])
    }
  })

  canvas.addEventListener('mouseup', (ev) => {
    if (ev.button === 0) {
      addEvent([Protocol.INPUT_EV_MOUSE_UP, ...mousePos(ev)])
    }
  })

  canvas.addEventListener('mousemove', (ev) => {
    addEvent([Protocol.INPUT_EV_MOUSE_MOVE, ...mousePos(ev)])
  })

  canvas.addEventListener('wheel', (ev) => {
    if (viewport.canZoom(ev.deltaY < 0 ? 'in' : 'out')) {
      const evt = ev.deltaY < 0
        ? Protocol.INPUT_EV_ZOOM_IN
        : Protocol.INPUT_EV_ZOOM_OUT
      addEvent([evt, ...mousePos(ev)])
    }
  })

  window.addEventListener('keydown', (ev) => key(true, ev))
  window.addEventListener('keyup', (ev) => key(false, ev))

  window.addEventListener('keypress', (ev) => {
    if (!KEYS_ON) {
      return
    }
    if (ev.key === ' ') {
      addEvent([Protocol.INPUT_EV_TOGGLE_PREVIEW])
    }
    if (ev.key === 'F' || ev.key === 'f') {
      PIECE_VIEW_FIXED = !PIECE_VIEW_FIXED
      RERENDER = true
    }
    if (ev.key === 'G' || ev.key === 'g') {
      PIECE_VIEW_LOOSE = !PIECE_VIEW_LOOSE
      RERENDER = true
    }
  })

  const addEvent = (event) => {
    events.push(event)
  }

  const consumeAll = () => {
    if (events.length === 0) {
      return []
    }
    const all = events.slice()
    events = []
    return all
  }

  const createKeyEvents = () => {
    const amount = SHIFT ? 20 : 10
    const x = (LEFT ? amount : 0) - (RIGHT ? amount : 0)
    const y = (UP ? amount : 0) - (DOWN ? amount : 0)
    if (x !== 0 || y !== 0) {
      addEvent([Protocol.INPUT_EV_MOVE, x, y])
    }

    if (ZOOM_IN && ZOOM_OUT) {
      // cancel each other out
    } else if (ZOOM_IN) {
      if (viewport.canZoom('in')) {
        addEvent([Protocol.INPUT_EV_ZOOM_IN, ...canvasCenter()])
      }
    } else if (ZOOM_OUT) {
      if (viewport.canZoom('out')) {
        addEvent([Protocol.INPUT_EV_ZOOM_OUT, ...canvasCenter()])
      }
    }
  }

  const setHotkeys = (state) => {
    KEYS_ON = state
  }

  return {
    addEvent,
    consumeAll,
    createKeyEvents,
    setHotkeys,
  }
}

export async function main(gameId, clientId, wsAddress, MODE, TARGET_EL, HUD) {
  if (typeof DEBUG === 'undefined') window.DEBUG = false

  const shouldDrawPlayerText = (player) => {
    return MODE === MODE_REPLAY || player.id !== clientId
  }

  const cursorGrab = await Graphics.loadImageToBitmap('/grab.png')
  const cursorHand = await Graphics.loadImageToBitmap('/hand.png')
  const cursorGrabMask = await Graphics.loadImageToBitmap('/grab_mask.png')
  const cursorHandMask = await Graphics.loadImageToBitmap('/hand_mask.png')

  // all cursors must be of the same dimensions
  const CURSOR_W = cursorGrab.width
  const CURSOR_W_2 = Math.round(CURSOR_W / 2)
  const CURSOR_H = cursorGrab.height
  const CURSOR_H_2 = Math.round(CURSOR_H / 2)

  const cursors = {}
  const getPlayerCursor = async (p) => {
    const key = p.color + ' ' + p.d
    if (!cursors[key]) {
      const cursor = p.d ? cursorGrab : cursorHand
      const mask = p.d ? cursorGrabMask : cursorHandMask
      cursors[key] = await Graphics.colorize(cursor, mask, p.color)
    }
    return cursors[key]
  }

  // Create a canvas and attach adapters to it so we can work with it
  const canvas = addCanvasToDom(TARGET_EL, Graphics.createCanvas())

  // stuff only available in replay mode...
  // TODO: refactor
  const REPLAY = {
    log: null,
    logIdx: 0,
    speeds: [0.5, 1, 2, 5, 10, 20, 50],
    speedIdx: 1,
    paused: false,
    lastRealTs: null,
    lastGameTs: null,
    gameStartTs: null,
  }

  let TIME
  if (MODE === MODE_PLAY) {
    const game = await Communication.connect(wsAddress, gameId, clientId)
    const gameObject = Util.decodeGame(game)
    Game.setGame(gameObject.id, gameObject)
    TIME = () => Time.timestamp()
  } else if (MODE === MODE_REPLAY) {
    const {game, log} = await Communication.connectReplay(wsAddress, gameId, clientId)
    const gameObject = Util.decodeGame(game)
    Game.setGame(gameObject.id, gameObject)
    REPLAY.log = log
    REPLAY.lastRealTs = Time.timestamp()
    REPLAY.gameStartTs = REPLAY.log[0][REPLAY.log[0].length - 2]
    REPLAY.lastGameTs = REPLAY.gameStartTs
    TIME = () => REPLAY.lastGameTs
  } else {
    throw '[ 2020-12-22 MODE invalid, must be play|replay ]'
  }

  const TILE_DRAW_OFFSET = Game.getTileDrawOffset(gameId)
  const TILE_DRAW_SIZE = Game.getTileDrawSize(gameId)
  const PUZZLE_WIDTH = Game.getPuzzleWidth(gameId)
  const PUZZLE_HEIGHT = Game.getPuzzleHeight(gameId)
  const TABLE_WIDTH = Game.getTableWidth(gameId)
  const TABLE_HEIGHT = Game.getTableHeight(gameId)

  const BOARD_POS = {
    x: (TABLE_WIDTH - PUZZLE_WIDTH) / 2,
    y: (TABLE_HEIGHT - PUZZLE_HEIGHT) / 2
  }
  const BOARD_DIM = {
    w: PUZZLE_WIDTH,
    h: PUZZLE_HEIGHT,
  }
  const PIECE_DIM = {
    w: TILE_DRAW_SIZE,
    h: TILE_DRAW_SIZE,
  }

  const bitmaps = await PuzzleGraphics.loadPuzzleBitmaps(Game.getPuzzle(gameId))

  const fireworks = new fireworksController(canvas, Game.getRng(gameId))
  fireworks.init(canvas)

  const ctx = canvas.getContext('2d')
  canvas.classList.add('loaded')

  // initialize some view data
  // this global data will change according to input events
  const viewport = new Camera()
  // center viewport
  viewport.move(
    -(TABLE_WIDTH - canvas.width) /2,
    -(TABLE_HEIGHT - canvas.height) /2
  )

  const evts = new EventAdapter(canvas, window, viewport)

  const previewImageUrl = Game.getImageUrl(gameId)

  const updateTimerElements = () => {
    const startTs = Game.getStartTs(gameId)
    const finishTs = Game.getFinishTs(gameId)
    const ts = TIME()

    HUD.setFinished(!!(finishTs))
    HUD.setDuration((finishTs || ts) - startTs)
  }

  updateTimerElements()
  HUD.setPiecesDone(Game.getFinishedTileCount(gameId))
  HUD.setPiecesTotal(Game.getTileCount(gameId))
  const ts = TIME()
  HUD.setActivePlayers(Game.getActivePlayers(gameId, ts))
  HUD.setIdlePlayers(Game.getIdlePlayers(gameId, ts))

  const longFinished = !! Game.getFinishTs(gameId)
  let finished = longFinished
  const justFinished = () => finished && !longFinished

  const playerBgColor = () => {
    return (Game.getPlayerBgColor(gameId, clientId)
        || localStorage.getItem('bg_color')
        || '#222222')
  }
  const playerColor = () => {
    return (Game.getPlayerColor(gameId, clientId)
        || localStorage.getItem('player_color')
        || '#ffffff')
  }
  const playerName = () => {
    return (Game.getPlayerName(gameId, clientId)
        || localStorage.getItem('player_name')
        || 'anon')
  }

  const doSetSpeedStatus = () => {
    HUD.setReplaySpeed(REPLAY.speeds[REPLAY.speedIdx])
    HUD.setReplayPaused(REPLAY.paused)
  }

  const replayOnSpeedUp = () => {
    if (REPLAY.speedIdx + 1 < REPLAY.speeds.length) {
      REPLAY.speedIdx++
      doSetSpeedStatus()
    }
  }
  const replayOnSpeedDown = () => {
    if (REPLAY.speedIdx >= 1) {
      REPLAY.speedIdx--
      doSetSpeedStatus()
    }
  }
  const replayOnPauseToggle = () => {
    REPLAY.paused = !REPLAY.paused
    doSetSpeedStatus()
  }

  if (MODE === MODE_PLAY) {
    setInterval(updateTimerElements, 1000)
  } else if (MODE === MODE_REPLAY) {
    doSetSpeedStatus()
  }

  if (MODE === MODE_PLAY) {
    Communication.onServerChange((msg) => {
      const msgType = msg[0]
      const evClientId = msg[1]
      const evClientSeq = msg[2]
      const evChanges = msg[3]
      for (const [changeType, changeData] of evChanges) {
        switch (changeType) {
          case Protocol.CHANGE_PLAYER: {
            const p = Util.decodePlayer(changeData)
            if (p.id !== clientId) {
              Game.setPlayer(gameId, p.id, p)
              RERENDER = true
            }
          } break;
          case Protocol.CHANGE_TILE: {
            const t = Util.decodeTile(changeData)
            Game.setTile(gameId, t.idx, t)
            RERENDER = true
          } break;
          case Protocol.CHANGE_DATA: {
            Game.setPuzzleData(gameId, changeData)
            RERENDER = true
          } break;
        }
      }
      finished = !! Game.getFinishTs(gameId)
    })
  } else if (MODE === MODE_REPLAY) {
    // no external communication for replay mode,
    // only the REPLAY.log is relevant
    let inter = setInterval(() => {
      const realTs = Time.timestamp()
      if (REPLAY.paused) {
        REPLAY.lastRealTs = realTs
        return
      }
      const timePassedReal = realTs - REPLAY.lastRealTs
      const timePassedGame = timePassedReal * REPLAY.speeds[REPLAY.speedIdx]
      const maxGameTs = REPLAY.lastGameTs + timePassedGame
      do {
        if (REPLAY.paused) {
          break
        }
        const nextIdx = REPLAY.logIdx + 1
        if (nextIdx >= REPLAY.log.length) {
          clearInterval(inter)
          break
        }

        const logEntry = REPLAY.log[nextIdx]
        const nextTs = REPLAY.gameStartTs + logEntry[logEntry.length - 1]
        if (nextTs > maxGameTs) {
          break
        }

        const entryWithTs = logEntry.slice()
        entryWithTs[entryWithTs.length - 1] = nextTs
        if (entryWithTs[0] === Protocol.LOG_ADD_PLAYER) {
          Game.addPlayer(gameId, ...entryWithTs.slice(1))
          RERENDER = true
        } else if (entryWithTs[0] === Protocol.LOG_UPDATE_PLAYER) {
          const playerId = Game.getPlayerIdByIndex(gameId, entryWithTs[1])
          Game.addPlayer(gameId, playerId, ...entryWithTs.slice(2))
          RERENDER = true
        } else if (entryWithTs[0] === Protocol.LOG_HANDLE_INPUT) {
          const playerId = Game.getPlayerIdByIndex(gameId, entryWithTs[1])
          Game.handleInput(gameId, playerId, ...entryWithTs.slice(2))
          RERENDER = true
        }
        REPLAY.logIdx = nextIdx
      } while (true)
      REPLAY.lastRealTs = realTs
      REPLAY.lastGameTs = maxGameTs
      updateTimerElements()
    }, 50)
  }

  let _last_mouse_down = null
  const onUpdate = () => {
    // handle key downs once per onUpdate
    // this will create Protocol.INPUT_EV_MOVE events if something
    // relevant is pressed
    evts.createKeyEvents()

    for (const evt of evts.consumeAll()) {
      if (MODE === MODE_PLAY) {
        // LOCAL ONLY CHANGES
        // -------------------------------------------------------------
        const type = evt[0]
        if (type === Protocol.INPUT_EV_MOVE) {
          const diffX = evt[1]
          const diffY = evt[2]
          RERENDER = true
          viewport.move(diffX, diffY)
        } else if (type === Protocol.INPUT_EV_MOUSE_MOVE) {
          if (_last_mouse_down && !Game.getFirstOwnedTile(gameId, clientId)) {
            // move the cam
            const pos = { x: evt[1], y: evt[2] }
            const mouse = viewport.worldToViewport(pos)
            const diffX = Math.round(mouse.x - _last_mouse_down.x)
            const diffY = Math.round(mouse.y - _last_mouse_down.y)
            RERENDER = true
            viewport.move(diffX, diffY)

            _last_mouse_down = mouse
          }
        } else if (type === Protocol.INPUT_EV_MOUSE_DOWN) {
          const pos = { x: evt[1], y: evt[2] }
          _last_mouse_down = viewport.worldToViewport(pos)
        } else if (type === Protocol.INPUT_EV_MOUSE_UP) {
          _last_mouse_down = null
        } else if (type === Protocol.INPUT_EV_ZOOM_IN) {
          const pos = { x: evt[1], y: evt[2] }
          RERENDER = true
          viewport.zoom('in', viewport.worldToViewport(pos))
        } else if (type === Protocol.INPUT_EV_ZOOM_OUT) {
          const pos = { x: evt[1], y: evt[2] }
          RERENDER = true
          viewport.zoom('out', viewport.worldToViewport(pos))
        } else if (type === Protocol.INPUT_EV_TOGGLE_PREVIEW) {
          HUD.togglePreview()
        }

        // LOCAL + SERVER CHANGES
        // -------------------------------------------------------------
        const ts = TIME()
        const changes = Game.handleInput(gameId, clientId, evt, ts)
        if (changes.length > 0) {
          RERENDER = true
        }
        Communication.sendClientEvent(evt)
      } else if (MODE === MODE_REPLAY) {
        // LOCAL ONLY CHANGES
        // -------------------------------------------------------------
        const type = evt[0]
        if (type === Protocol.INPUT_EV_MOVE) {
          const diffX = evt[1]
          const diffY = evt[2]
          RERENDER = true
          viewport.move(diffX, diffY)
        } else if (type === Protocol.INPUT_EV_MOUSE_MOVE) {
          if (_last_mouse_down) {
            // move the cam
            const pos = { x: evt[1], y: evt[2] }
            const mouse = viewport.worldToViewport(pos)
            const diffX = Math.round(mouse.x - _last_mouse_down.x)
            const diffY = Math.round(mouse.y - _last_mouse_down.y)
            RERENDER = true
            viewport.move(diffX, diffY)

            _last_mouse_down = mouse
          }
        } else if (type === Protocol.INPUT_EV_MOUSE_DOWN) {
          const pos = { x: evt[1], y: evt[2] }
          _last_mouse_down = viewport.worldToViewport(pos)
        } else if (type === Protocol.INPUT_EV_MOUSE_UP) {
          _last_mouse_down = null
        } else if (type === Protocol.INPUT_EV_ZOOM_IN) {
          const pos = { x: evt[1], y: evt[2] }
          RERENDER = true
          viewport.zoom('in', viewport.worldToViewport(pos))
        } else if (type === Protocol.INPUT_EV_ZOOM_OUT) {
          const pos = { x: evt[1], y: evt[2] }
          RERENDER = true
          viewport.zoom('out', viewport.worldToViewport(pos))
        } else if (type === Protocol.INPUT_EV_TOGGLE_PREVIEW) {
          HUD.togglePreview()
        }
      }
    }

    finished = !! Game.getFinishTs(gameId)
    if (justFinished()) {
      fireworks.update()
      RERENDER = true
    }
  }

  const onRender = async () => {
    if (!RERENDER) {
      return
    }

    const ts = TIME()

    let pos
    let dim
    let bmp

    if (DEBUG) Debug.checkpoint_start(0)

    // CLEAR CTX
    // ---------------------------------------------------------------
    ctx.fillStyle = playerBgColor()
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    if (DEBUG) Debug.checkpoint('clear done')
    // ---------------------------------------------------------------


    // DRAW BOARD
    // ---------------------------------------------------------------
    pos = viewport.worldToViewportRaw(BOARD_POS)
    dim = viewport.worldDimToViewportRaw(BOARD_DIM)
    ctx.fillStyle = 'rgba(255, 255, 255, .3)'
    ctx.fillRect(pos.x, pos.y, dim.w, dim.h)
    if (DEBUG) Debug.checkpoint('board done')
    // ---------------------------------------------------------------


    // DRAW TILES
    // ---------------------------------------------------------------
    const tiles = Game.getTilesSortedByZIndex(gameId)
    if (DEBUG) Debug.checkpoint('get tiles done')

    dim = viewport.worldDimToViewportRaw(PIECE_DIM)
    for (const tile of tiles) {
      if (!shouldDrawPiece(tile)) {
        continue
      }
      bmp = bitmaps[tile.idx]
      pos = viewport.worldToViewportRaw({
        x: TILE_DRAW_OFFSET + tile.pos.x,
        y: TILE_DRAW_OFFSET + tile.pos.y,
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
    const texts = []
    // Cursors
    for (const p of Game.getActivePlayers(gameId, ts)) {
      bmp = await getPlayerCursor(p)
      pos = viewport.worldToViewport(p)
      ctx.drawImage(bmp, pos.x - CURSOR_W_2, pos.y - CURSOR_H_2)
      if (shouldDrawPlayerText(p)) {
        // performance:
        // not drawing text directly here, to have less ctx
        // switches between drawImage and fillTxt
        texts.push([`${p.name} (${p.points})`, pos.x, pos.y + CURSOR_H])
      }
    }

    // Names
    ctx.fillStyle = 'white'
    ctx.textAlign = 'center'
    for (const [txt, x, y] of texts) {
      ctx.fillText(txt, x, y)
    }

    if (DEBUG) Debug.checkpoint('players done')

    // propagate HUD changes
    // ---------------------------------------------------------------
    HUD.setActivePlayers(Game.getActivePlayers(gameId, ts))
    HUD.setIdlePlayers(Game.getIdlePlayers(gameId, ts))
    HUD.setPiecesDone(Game.getFinishedTileCount(gameId))
    if (DEBUG) Debug.checkpoint('HUD done')
    // ---------------------------------------------------------------

    if (justFinished()) {
      fireworks.render()
    }

    RERENDER = false
  }

  run({
    update: onUpdate,
    render: onRender,
  })

  return {
    setHotkeys: (state) => {
      evts.setHotkeys(state)
    },
    onBgChange: (value) => {
      localStorage.setItem('bg_color', value)
      evts.addEvent([Protocol.INPUT_EV_BG_COLOR, value])
    },
    onColorChange: (value) => {
      localStorage.setItem('player_color', value)
      evts.addEvent([Protocol.INPUT_EV_PLAYER_COLOR, value])
    },
    onNameChange: (value) => {
      localStorage.setItem('player_name', value)
      evts.addEvent([Protocol.INPUT_EV_PLAYER_NAME, value])
    },
    replayOnSpeedUp,
    replayOnSpeedDown,
    replayOnPauseToggle,
    previewImageUrl,
    player: {
      background: playerBgColor(),
      color: playerColor(),
      name: playerName(),
    },
    disconnect: Communication.disconnect,
  }
}
