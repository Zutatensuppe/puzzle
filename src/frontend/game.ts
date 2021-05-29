"use strict"

import {run} from './gameloop'
import Camera from './Camera'
import Graphics from './Graphics'
import Debug from './Debug'
import Communication from './Communication'
import Util from './../common/Util'
import PuzzleGraphics from './PuzzleGraphics'
import Game, { Game as GameType, Player, Piece, EncodedGame, ReplayData, Timestamp } from './../common/GameCommon'
import fireworksController from './Fireworks'
import Protocol from '../common/Protocol'
import Time from '../common/Time'
import { Dim, Point } from '../common/Geometry'
import { FixedLengthArray } from '../common/Types'

declare global {
  interface Window {
      DEBUG?: boolean
  }
}

// @ts-ignore
const images = import.meta.globEager('./*.png')

export const MODE_PLAY = 'play'
export const MODE_REPLAY = 'replay'

let PIECE_VIEW_FIXED = true
let PIECE_VIEW_LOOSE = true

interface Hud {
  setActivePlayers: (v: Array<any>) => void
  setIdlePlayers: (v: Array<any>) => void
  setFinished: (v: boolean) => void
  setDuration: (v: number) => void
  setPiecesDone: (v: number) => void
  setPiecesTotal: (v: number) => void
  setConnectionState: (v: number) => void
  togglePreview: () => void
  setReplaySpeed?: (v: number) => void
  setReplayPaused?: (v: boolean) => void
}
interface Replay {
  final: boolean
  requesting: boolean
  log: Array<any> // current log entries
  logPointer: number // pointer to current item in the log array
  speeds: Array<number>
  speedIdx: number
  paused: boolean
  lastRealTs: number
  lastGameTs: number
  gameStartTs: number
  //
  dataOffset: number
  dataSize: number
}

const shouldDrawPiece = (piece: Piece) => {
  if (piece.owner === -1) {
    return PIECE_VIEW_FIXED
  }
  return PIECE_VIEW_LOOSE
}

let RERENDER = true

function addCanvasToDom(TARGET_EL: HTMLElement, canvas: HTMLCanvasElement) {
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

function EventAdapter (canvas: HTMLCanvasElement, window: any, viewport: any) {
  let events: Array<Array<any>> = []

  let KEYS_ON = true

  let LEFT = false
  let RIGHT = false
  let UP = false
  let DOWN = false
  let ZOOM_IN = false
  let ZOOM_OUT = false
  let SHIFT = false

  const toWorldPoint = (x: number, y: number) => {
    const pos = viewport.viewportToWorld({x, y})
    return [pos.x, pos.y]
  }

  const mousePos = (ev: MouseEvent) => toWorldPoint(ev.offsetX, ev.offsetY)
  const canvasCenter = () => toWorldPoint(canvas.width / 2, canvas.height / 2)

  const key = (state: boolean, ev: KeyboardEvent) => {
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

  window.addEventListener('keydown', (ev: KeyboardEvent) => key(true, ev))
  window.addEventListener('keyup', (ev: KeyboardEvent) => key(false, ev))

  window.addEventListener('keypress', (ev: KeyboardEvent) => {
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

  const addEvent = (event: Array<any>) => {
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

  const setHotkeys = (state: boolean) => {
    KEYS_ON = state
  }

  return {
    addEvent,
    consumeAll,
    createKeyEvents,
    setHotkeys,
  }
}

export async function main(
  gameId: string,
  clientId: string,
  wsAddress: string,
  MODE: string,
  TARGET_EL: HTMLElement,
  HUD: Hud
) {
  if (typeof window.DEBUG === 'undefined') window.DEBUG = false

  const shouldDrawPlayer = (player: Player) => {
    return MODE === MODE_REPLAY || player.id !== clientId
  }

  const cursorGrab = await Graphics.loadImageToBitmap(images['./grab.png'].default)
  const cursorHand = await Graphics.loadImageToBitmap(images['./hand.png'].default)
  const cursorGrabMask = await Graphics.loadImageToBitmap(images['./grab_mask.png'].default)
  const cursorHandMask = await Graphics.loadImageToBitmap(images['./hand_mask.png'].default)

  // all cursors must be of the same dimensions
  const CURSOR_W = cursorGrab.width
  const CURSOR_W_2 = Math.round(CURSOR_W / 2)
  const CURSOR_H = cursorGrab.height
  const CURSOR_H_2 = Math.round(CURSOR_H / 2)

  const cursors: Record<string, ImageBitmap> = {}
  const getPlayerCursor = async (p: Player) => {
    const key = p.color + ' ' + p.d
    if (!cursors[key]) {
      const cursor = p.d ? cursorGrab : cursorHand
      if (p.color) {
        const mask = p.d ? cursorGrabMask : cursorHandMask
        cursors[key] = await createImageBitmap(
          Graphics.colorizedCanvas(cursor, mask, p.color)
        )
      } else {
        cursors[key] = cursor
      }
    }
    return cursors[key]
  }

  // Create a canvas and attach adapters to it so we can work with it
  const canvas = addCanvasToDom(TARGET_EL, Graphics.createCanvas())

  // stuff only available in replay mode...
  // TODO: refactor
  const REPLAY: Replay = {
    final: false,
    requesting: true,
    log: [],
    logPointer: 0,
    speeds: [0.5, 1, 2, 5, 10, 20, 50, 100, 250, 500],
    speedIdx: 1,
    paused: false,
    lastRealTs: 0,
    lastGameTs: 0,
    gameStartTs: 0,
    dataOffset: 0,
    dataSize: 10000,
  }

  Communication.onConnectionStateChange((state) => {
    HUD.setConnectionState(state)
  })

  const queryNextReplayBatch = async (
    gameId: string
  ): Promise<ReplayData> => {
    REPLAY.requesting = true
    const replay: ReplayData = await Communication.requestReplayData(
      gameId,
      REPLAY.dataOffset,
      REPLAY.dataSize
    )
    REPLAY.dataOffset += REPLAY.dataSize
    REPLAY.requesting = false
    return replay
  }

  const getNextReplayBatch = async (
    gameId: string
  ) => {
    const replay: ReplayData = await queryNextReplayBatch(gameId)
    // cut log that was already handled
    REPLAY.log = REPLAY.log.slice(REPLAY.logPointer)
    REPLAY.logPointer = 0

    REPLAY.log.push(...replay.log)
    if (replay.log.length < REPLAY.dataSize) {
      REPLAY.final = true
    }
  }

  let TIME: () => number = () => 0
  const connect = async () => {
    if (MODE === MODE_PLAY) {
      const game: EncodedGame = await Communication.connect(wsAddress, gameId, clientId)
      const gameObject: GameType = Util.decodeGame(game)
      Game.setGame(gameObject.id, gameObject)
      TIME = () => Time.timestamp()
    } else if (MODE === MODE_REPLAY) {
      const replay: ReplayData = await queryNextReplayBatch(gameId)
      if (!replay.game) {
        throw '[ 2021-05-29 no game received ]'
      }
      const gameObject: GameType = Util.decodeGame(replay.game)
      Game.setGame(gameObject.id, gameObject)
      REPLAY.requesting = false
      REPLAY.log = replay.log
      REPLAY.lastRealTs = Time.timestamp()
      REPLAY.gameStartTs = parseInt(REPLAY.log[0][4], 10)
      REPLAY.lastGameTs = REPLAY.gameStartTs
      TIME = () => REPLAY.lastGameTs
    } else {
      throw '[ 2020-12-22 MODE invalid, must be play|replay ]'
    }

    // rerender after (re-)connect
    RERENDER = true
  }

  await connect()

  const PIECE_DRAW_OFFSET = Game.getPieceDrawOffset(gameId)
  const PIECE_DRAW_SIZE = Game.getPieceDrawSize(gameId)
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
    w: PIECE_DRAW_SIZE,
    h: PIECE_DRAW_SIZE,
  }

  const bitmaps = await PuzzleGraphics.loadPuzzleBitmaps(Game.getPuzzle(gameId))

  const fireworks = new fireworksController(canvas, Game.getRng(gameId))
  fireworks.init()

  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  canvas.classList.add('loaded')

  // initialize some view data
  // this global data will change according to input events
  const viewport = Camera()
  // center viewport
  viewport.move(
    -(TABLE_WIDTH - canvas.width) /2,
    -(TABLE_HEIGHT - canvas.height) /2
  )

  const evts = EventAdapter(canvas, window, viewport)

  const previewImageUrl = Game.getImageUrl(gameId)

  const updateTimerElements = () => {
    const startTs = Game.getStartTs(gameId)
    const finishTs = Game.getFinishTs(gameId)
    const ts = TIME()

    HUD.setFinished(!!(finishTs))
    HUD.setDuration((finishTs || ts) - startTs)
  }

  updateTimerElements()
  HUD.setPiecesDone(Game.getFinishedPiecesCount(gameId))
  HUD.setPiecesTotal(Game.getPieceCount(gameId))
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

  let cursorDown: string = ''
  let cursor: string = ''
  let cursorState: boolean = false
  const updatePlayerCursorState = (d: boolean) => {
    cursorState = d
    const [url, fallback] = d ? [cursorDown, 'grab'] : [cursor, 'default']
    canvas.style.cursor = `url('${url}') ${CURSOR_W_2} ${CURSOR_H_2}, ${fallback}`
  }
  const updatePlayerCursorColor = (color: string) => {
    cursorDown = Graphics.colorizedCanvas(cursorGrab, cursorGrabMask, color).toDataURL()
    cursor = Graphics.colorizedCanvas(cursorHand, cursorHandMask, color).toDataURL()
    updatePlayerCursorState(cursorState)
  }
  updatePlayerCursorColor(playerColor())

  const doSetSpeedStatus = () => {
    if (HUD.setReplaySpeed) {
      HUD.setReplaySpeed(REPLAY.speeds[REPLAY.speedIdx])
    }
    if (HUD.setReplayPaused) {
      HUD.setReplayPaused(REPLAY.paused)
    }
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
    // TODO: register onServerChange function before connecting to server
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
            const t = Util.decodePiece(changeData)
            Game.setPiece(gameId, t.idx, t)
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
      if (REPLAY.requesting) {
        REPLAY.lastRealTs = realTs
        return
      }

      if (REPLAY.logPointer + 1 >= REPLAY.log.length) {
        REPLAY.lastRealTs = realTs
        getNextReplayBatch(gameId)
        return
      }

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
        const nextIdx = REPLAY.logPointer + 1
        if (nextIdx >= REPLAY.log.length) {
          if (REPLAY.final) {
            clearInterval(inter)
          }
          break
        }

        const logEntry = REPLAY.log[nextIdx]
        const nextTs: Timestamp = REPLAY.gameStartTs + logEntry[logEntry.length - 1]
        if (nextTs > maxGameTs) {
          break
        }

        const entryWithTs = logEntry.slice()
        if (entryWithTs[0] === Protocol.LOG_ADD_PLAYER) {
          const playerId = entryWithTs[1]
          Game.addPlayer(gameId, playerId, nextTs)
          RERENDER = true
        } else if (entryWithTs[0] === Protocol.LOG_UPDATE_PLAYER) {
          const playerId = Game.getPlayerIdByIndex(gameId, entryWithTs[1])
          if (!playerId) {
            throw '[ 2021-05-17 player not found (update player) ]'
          }
          Game.addPlayer(gameId, playerId, nextTs)
          RERENDER = true
        } else if (entryWithTs[0] === Protocol.LOG_HANDLE_INPUT) {
          const playerId = Game.getPlayerIdByIndex(gameId, entryWithTs[1])
          if (!playerId) {
            throw '[ 2021-05-17 player not found (handle input) ]'
          }
          const input = entryWithTs[2]
          Game.handleInput(gameId, playerId, input, nextTs)
          RERENDER = true
        }
        REPLAY.logPointer = nextIdx
      } while (true)
      REPLAY.lastRealTs = realTs
      REPLAY.lastGameTs = maxGameTs
      updateTimerElements()
    }, 50)
  }

  let _last_mouse_down: Point|null = null
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
          if (_last_mouse_down && !Game.getFirstOwnedPiece(gameId, clientId)) {
            // move the cam
            const pos = { x: evt[1], y: evt[2] }
            const mouse = viewport.worldToViewport(pos)
            const diffX = Math.round(mouse.x - _last_mouse_down.x)
            const diffY = Math.round(mouse.y - _last_mouse_down.y)
            RERENDER = true
            viewport.move(diffX, diffY)

            _last_mouse_down = mouse
          }
        } else if (type === Protocol.INPUT_EV_PLAYER_COLOR) {
          updatePlayerCursorColor(evt[1])
        } else if (type === Protocol.INPUT_EV_MOUSE_DOWN) {
          const pos = { x: evt[1], y: evt[2] }
          _last_mouse_down = viewport.worldToViewport(pos)
          updatePlayerCursorState(true)
        } else if (type === Protocol.INPUT_EV_MOUSE_UP) {
          _last_mouse_down = null
          updatePlayerCursorState(false)
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

    let pos: Point
    let dim: Dim
    let bmp: ImageBitmap

    if (window.DEBUG) Debug.checkpoint_start(0)

    // CLEAR CTX
    // ---------------------------------------------------------------
    ctx.fillStyle = playerBgColor()
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    if (window.DEBUG) Debug.checkpoint('clear done')
    // ---------------------------------------------------------------


    // DRAW BOARD
    // ---------------------------------------------------------------
    pos = viewport.worldToViewportRaw(BOARD_POS)
    dim = viewport.worldDimToViewportRaw(BOARD_DIM)
    ctx.fillStyle = 'rgba(255, 255, 255, .3)'
    ctx.fillRect(pos.x, pos.y, dim.w, dim.h)
    if (window.DEBUG) Debug.checkpoint('board done')
    // ---------------------------------------------------------------


    // DRAW TILES
    // ---------------------------------------------------------------
    const tiles = Game.getPiecesSortedByZIndex(gameId)
    if (window.DEBUG) Debug.checkpoint('get tiles done')

    dim = viewport.worldDimToViewportRaw(PIECE_DIM)
    for (const tile of tiles) {
      if (!shouldDrawPiece(tile)) {
        continue
      }
      bmp = bitmaps[tile.idx]
      pos = viewport.worldToViewportRaw({
        x: PIECE_DRAW_OFFSET + tile.pos.x,
        y: PIECE_DRAW_OFFSET + tile.pos.y,
      })
      ctx.drawImage(bmp,
        0, 0, bmp.width, bmp.height,
        pos.x, pos.y, dim.w, dim.h
      )
    }
    if (window.DEBUG) Debug.checkpoint('tiles done')
    // ---------------------------------------------------------------


    // DRAW PLAYERS
    // ---------------------------------------------------------------
    const texts: Array<FixedLengthArray<[string, number, number]>> = []
    // Cursors
    for (const p of Game.getActivePlayers(gameId, ts)) {
      if (shouldDrawPlayer(p)) {
        bmp = await getPlayerCursor(p)
        pos = viewport.worldToViewport(p)
        ctx.drawImage(bmp, pos.x - CURSOR_W_2, pos.y - CURSOR_H_2)
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

    if (window.DEBUG) Debug.checkpoint('players done')

    // propagate HUD changes
    // ---------------------------------------------------------------
    HUD.setActivePlayers(Game.getActivePlayers(gameId, ts))
    HUD.setIdlePlayers(Game.getIdlePlayers(gameId, ts))
    HUD.setPiecesDone(Game.getFinishedPiecesCount(gameId))
    if (window.DEBUG) Debug.checkpoint('HUD done')
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
    setHotkeys: (state: boolean) => {
      evts.setHotkeys(state)
    },
    onBgChange: (value: string) => {
      localStorage.setItem('bg_color', value)
      evts.addEvent([Protocol.INPUT_EV_BG_COLOR, value])
    },
    onColorChange: (value: string) => {
      localStorage.setItem('player_color', value)
      evts.addEvent([Protocol.INPUT_EV_PLAYER_COLOR, value])
    },
    onNameChange: (value: string) => {
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
    connect: connect,
  }
}
