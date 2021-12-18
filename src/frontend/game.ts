"use strict"

import { Emitter, EventType } from 'mitt'
import { GameLoopInstance, run } from './gameloop'
import Camera, { Snapshot } from './Camera'
import Graphics from './Graphics'
import Debug from './Debug'
import Communication from './Communication'
import Util, { logger } from './../common/Util'
import PuzzleGraphics from './PuzzleGraphics'
import Game from './../common/GameCommon'
import fireworksController from './Fireworks'
import Protocol from '../common/Protocol'
import Time from '../common/Time'
import settings from './settings'
import { SETTINGS, DEFAULTS } from './settings'
import { Dim, Point } from '../common/Geometry'
import {
  FixedLengthArray,
  Game as GameType,
  Player,
  Piece,
  EncodedGame,
  ReplayData,
  Timestamp,
  ServerEvent,
  PuzzleStatus,
} from '../common/Types'
import EventAdapter from './EventAdapter'
declare global {
  interface Window {
      DEBUG?: boolean
  }
}

const log = logger('game.ts')

// @ts-ignore
const images = import.meta.globEager('./*.png')

// @ts-ignore
const sounds = import.meta.globEager('./*.mp3')

export const MODE_PLAY = 'play'
export const MODE_REPLAY = 'replay'

let PIECE_VIEW_FIXED = true
let PIECE_VIEW_LOOSE = true

interface Replay {
  final: boolean
  log: Array<any> // current log entries
  logPointer: number // pointer to current item in the log array
  speeds: Array<number>
  speedIdx: number
  paused: boolean
  lastRealTs: number
  lastGameTs: number
  gameStartTs: number
  skipNonActionPhases: boolean
  //
  dataOffset: number
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

export async function main(
  gameId: string,
  clientId: string,
  wsAddress: string,
  MODE: string,
  TARGET_EL: HTMLElement,
  eventBus: Emitter<Record<EventType, unknown>>,
) {
  if (typeof window.DEBUG === 'undefined') window.DEBUG = false

  const shouldDrawPlayer = (player: Player) => {
    return MODE === MODE_REPLAY || player.id !== clientId
  }

  const click = sounds['./click.mp3'].default
  const clickAudio = new Audio(click)

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
    log: [],
    logPointer: 0,
    speeds: [0.5, 1, 2, 5, 10, 20, 50, 100, 250, 500],
    speedIdx: 1,
    paused: false,
    lastRealTs: 0,
    lastGameTs: 0,
    gameStartTs: 0,
    skipNonActionPhases: true,
    dataOffset: 0,
  }

  Communication.onConnectionStateChange((state) => {
    eventBus.emit('connectionState', state)
  })

  const queryNextReplayBatch = async (
    gameId: string
  ): Promise<ReplayData> => {
    const offset = REPLAY.dataOffset
    REPLAY.dataOffset += 10000 // meh
    const replay: ReplayData = await Communication.requestReplayData(
      gameId,
      offset
    )

    // cut log that was already handled
    REPLAY.log = REPLAY.log.slice(REPLAY.logPointer)
    REPLAY.logPointer = 0
    REPLAY.log.push(...replay.log)

    if (replay.log.length === 0) {
      REPLAY.final = true
    }
    return replay
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

      REPLAY.lastRealTs = Time.timestamp()
      REPLAY.gameStartTs = parseInt(replay.log[0][4], 10)
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
  eventBus.emit('puzzleCut')

  let viewportToggleSlot: string = '';
  const viewportSnapshots: Record<string, Snapshot> = {}
  // initialize some view data
  // this global data will change according to input events
  const viewport = Camera()

  const centerPuzzle = () => {
    // center on the puzzle
    viewport.reset()
    viewport.move(
      -(TABLE_WIDTH - canvas.width) /2,
      -(TABLE_HEIGHT - canvas.height) /2
    )

    // zoom viewport to fit whole puzzle in
    const x = viewport.worldDimToViewport(BOARD_DIM)
    const border = 20
    const targetW = canvas.width - (border * 2)
    const targetH = canvas.height - (border * 2)
    if (
      (x.w > targetW || x.h > targetH)
      || (x.w < targetW && x.h < targetH)
    ) {
      const zoom = Math.min(targetW / x.w, targetH / x.h)
      viewport.setZoom(zoom, {
        x: canvas.width / 2,
        y: canvas.height / 2,
      })
    }
  }
  const handleViewportSnapshot = (slot: string): void => {
    if (viewportSnapshots['last'] && viewportToggleSlot === slot) {
      viewport.fromSnapshot(viewportSnapshots['last'])
      delete viewportSnapshots['last']
    } else if (viewportSnapshots[slot]) {
      viewportSnapshots['last'] = viewport.snapshot()
      viewportToggleSlot = slot
      viewport.fromSnapshot(viewportSnapshots[slot])
    }
  }

  centerPuzzle()
  viewportSnapshots['center'] = viewport.snapshot()

  const evts = EventAdapter(canvas, window, viewport, MODE)

  const previewImageUrl = Game.getImageUrl(gameId)

  const updateStatus = (ts: number) => {
    const startTs = Game.getStartTs(gameId)
    const finishTs = Game.getFinishTs(gameId)

    eventBus.emit('status', {
      finished: !!(finishTs),
      duration: (finishTs || ts) - startTs,
      piecesDone: Game.getFinishedPiecesCount(gameId),
      piecesTotal: Game.getPieceCount(gameId),
    })
    eventBus.emit('players', {
      active: Game.getActivePlayers(gameId, ts),
      idle: Game.getIdlePlayers(gameId, ts),
    })
  }

  updateStatus(TIME())

  const longFinished = !! Game.getFinishTs(gameId)
  let finished = longFinished
  const justFinished = () => finished && !longFinished

  const playerSoundVolume = (): number => {
    return settings.getInt(SETTINGS.SOUND_VOLUME, DEFAULTS.SOUND_VOLUME)
  }
  const playerSoundEnabled = (): boolean => {
    return settings.getBool(SETTINGS.SOUND_ENABLED, DEFAULTS.SOUND_ENABLED)
  }
  const showPlayerNames = (): boolean => {
    return settings.getBool(SETTINGS.SHOW_PLAYER_NAMES, DEFAULTS.SHOW_PLAYER_NAMES)
  }

  const playClick = () => {
    const vol = playerSoundVolume()
    clickAudio.volume = vol / 100
    clickAudio.play()
  }

  const playerBgColor = () => {
    if (MODE === MODE_REPLAY) {
      return settings.getStr(SETTINGS.COLOR_BACKGROUND, DEFAULTS.COLOR_BACKGROUND)
    }
    return Game.getPlayerBgColor(gameId, clientId)
        || settings.getStr(SETTINGS.COLOR_BACKGROUND, DEFAULTS.COLOR_BACKGROUND)
  }
  const playerColor = () => {
    if (MODE === MODE_REPLAY) {
      return settings.getStr(SETTINGS.PLAYER_COLOR, DEFAULTS.PLAYER_COLOR)
    }
    return Game.getPlayerColor(gameId, clientId)
        || settings.getStr(SETTINGS.PLAYER_COLOR, DEFAULTS.PLAYER_COLOR)
  }
  const playerName = () => {
    if (MODE === MODE_REPLAY) {
      return settings.getStr(SETTINGS.PLAYER_NAME, DEFAULTS.PLAYER_NAME)
    }
    return Game.getPlayerName(gameId, clientId)
        || settings.getStr(SETTINGS.PLAYER_NAME, DEFAULTS.PLAYER_NAME)
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
    eventBus.emit('replaySpeed', REPLAY.speeds[REPLAY.speedIdx])
    eventBus.emit('replayPaused', REPLAY.paused)
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

  const intervals: NodeJS.Timeout[] = []
  let to: NodeJS.Timeout
  const clearIntervals = () => {
    intervals.forEach(inter => {
      clearInterval(inter)
    })
    if (to) {
      clearTimeout(to)
    }
  }

  let gameLoopInstance: GameLoopInstance
  const unload = () => {
    clearIntervals()
    if (gameLoopInstance) {
      gameLoopInstance.stop()
    }
  }

  if (MODE === MODE_PLAY) {
    intervals.push(setInterval(() => {
      updateStatus(TIME())
    }, 1000))
  } else if (MODE === MODE_REPLAY) {
    doSetSpeedStatus()
  }

  if (MODE === MODE_PLAY) {
    Communication.onServerChange((msg: ServerEvent) => {
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
    const handleLogEntry = (logEntry: any[], ts: Timestamp) => {
      const entry = logEntry
      if (entry[0] === Protocol.LOG_ADD_PLAYER) {
        const playerId = entry[1]
        Game.addPlayer(gameId, playerId, ts)
        return true
      }
      if (entry[0] === Protocol.LOG_UPDATE_PLAYER) {
        const playerId = Game.getPlayerIdByIndex(gameId, entry[1])
        if (!playerId) {
          throw '[ 2021-05-17 player not found (update player) ]'
        }
        Game.addPlayer(gameId, playerId, ts)
        return true
      }
      if (entry[0] === Protocol.LOG_HANDLE_INPUT) {
        const playerId = Game.getPlayerIdByIndex(gameId, entry[1])
        if (!playerId) {
          throw '[ 2021-05-17 player not found (handle input) ]'
        }
        const input = entry[2]
        Game.handleInput(gameId, playerId, input, ts)
        return true
      }
      return false
    }

    let GAME_TS = REPLAY.lastGameTs
    const next = async () => {
      if (REPLAY.logPointer + 1 >= REPLAY.log.length) {
        await queryNextReplayBatch(gameId)
      }

      const realTs = Time.timestamp()
      if (REPLAY.paused) {
        REPLAY.lastRealTs = realTs
        to = setTimeout(next, 50)
        return
      }
      const timePassedReal = realTs - REPLAY.lastRealTs
      const timePassedGame = timePassedReal * REPLAY.speeds[REPLAY.speedIdx]
      let maxGameTs = REPLAY.lastGameTs + timePassedGame
      do {
        if (REPLAY.paused) {
          break
        }
        const nextIdx = REPLAY.logPointer + 1
        if (nextIdx >= REPLAY.log.length) {
          break
        }

        const currLogEntry = REPLAY.log[REPLAY.logPointer]
        const currTs: Timestamp = GAME_TS + currLogEntry[currLogEntry.length - 1]

        const nextLogEntry = REPLAY.log[nextIdx]
        const diffToNext = nextLogEntry[nextLogEntry.length - 1]
        const nextTs: Timestamp = currTs + diffToNext
        if (nextTs > maxGameTs) {
          // next log entry is too far into the future
          if (REPLAY.skipNonActionPhases && (maxGameTs + 500 * Time.MS < nextTs)) {
            maxGameTs += diffToNext
          }
          break
        }

        GAME_TS = currTs
        if (handleLogEntry(nextLogEntry, nextTs)) {
          RERENDER = true
        }
        REPLAY.logPointer = nextIdx
      } while (true)
      REPLAY.lastRealTs = realTs
      REPLAY.lastGameTs = maxGameTs
      updateStatus(TIME())

      if (!REPLAY.final) {
        to = setTimeout(next, 50)
      }
    }

    next()
  }

  let _last_mouse_down: Point|null = null
  const onUpdate = (): void => {
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
          const w = evt[1]
          const h = evt[2]
          const dim = viewport.worldDimToViewport({w, h})
          RERENDER = true
          viewport.move(dim.w, dim.h)
          delete viewportSnapshots['last']
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
            delete viewportSnapshots['last']
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
          delete viewportSnapshots['last']
        } else if (type === Protocol.INPUT_EV_ZOOM_OUT) {
          const pos = { x: evt[1], y: evt[2] }
          RERENDER = true
          viewport.zoom('out', viewport.worldToViewport(pos))
          delete viewportSnapshots['last']
        } else if (type === Protocol.INPUT_EV_TOGGLE_PREVIEW) {
          eventBus.emit('togglePreview')
        } else if (type === Protocol.INPUT_EV_TOGGLE_SOUNDS) {
          eventBus.emit('toggleSoundsEnabled')
        } else if (type === Protocol.INPUT_EV_TOGGLE_PLAYER_NAMES) {
          eventBus.emit('togglePlayerNames')
        } else if (type === Protocol.INPUT_EV_CENTER_FIT_PUZZLE) {
          handleViewportSnapshot('center')
        } else if (type === Protocol.INPUT_EV_TOGGLE_FIXED_PIECES) {
          PIECE_VIEW_FIXED = !PIECE_VIEW_FIXED
          RERENDER = true
        } else if (type === Protocol.INPUT_EV_TOGGLE_LOOSE_PIECES) {
          PIECE_VIEW_LOOSE = !PIECE_VIEW_LOOSE
          RERENDER = true
        } else if (type === Protocol.INPUT_EV_STORE_POS) {
          const slot: string = `${evt[1]}`
          viewportSnapshots[slot] = viewport.snapshot()
        } else if (type === Protocol.INPUT_EV_RESTORE_POS) {
          const slot: string = `${evt[1]}`
          handleViewportSnapshot(slot)
        }

        // LOCAL + SERVER CHANGES
        // -------------------------------------------------------------
        const ts = TIME()
        const changes = Game.handleInput(
          gameId,
          clientId,
          evt,
          ts,
          (playerId: string) => {
            if (playerSoundEnabled()) {
              playClick()
            }
          }
        )
        if (changes.length > 0) {
          RERENDER = true
        }
        Communication.sendClientEvent(evt)
      } else if (MODE === MODE_REPLAY) {
        // LOCAL ONLY CHANGES
        // -------------------------------------------------------------
        const type = evt[0]
        if (type === Protocol.INPUT_EV_REPLAY_TOGGLE_PAUSE) {
          replayOnPauseToggle()
        } else if (type === Protocol.INPUT_EV_REPLAY_SPEED_DOWN) {
          replayOnSpeedDown()
        } else if (type === Protocol.INPUT_EV_REPLAY_SPEED_UP) {
          replayOnSpeedUp()
        } else if (type === Protocol.INPUT_EV_MOVE) {
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
          eventBus.emit('togglePreview')
        } else if (type === Protocol.INPUT_EV_TOGGLE_SOUNDS) {
          eventBus.emit('toggleSoundsEnabled')
        } else if (type === Protocol.INPUT_EV_TOGGLE_PLAYER_NAMES) {
          eventBus.emit('togglePlayerNames')
        } else if (type === Protocol.INPUT_EV_CENTER_FIT_PUZZLE) {
          handleViewportSnapshot('center')
        } else if (type === Protocol.INPUT_EV_TOGGLE_FIXED_PIECES) {
          PIECE_VIEW_FIXED = !PIECE_VIEW_FIXED
          RERENDER = true
        } else if (type === Protocol.INPUT_EV_TOGGLE_LOOSE_PIECES) {
          PIECE_VIEW_LOOSE = !PIECE_VIEW_LOOSE
          RERENDER = true
        } else if (type === Protocol.INPUT_EV_STORE_POS) {
          const slot: string = `${evt[1]}`
          viewportSnapshots[slot] = viewport.snapshot()
        } else if (type === Protocol.INPUT_EV_RESTORE_POS) {
          const slot: string = `${evt[1]}`
          handleViewportSnapshot(slot)
        }
      }
    }

    finished = !! Game.getFinishTs(gameId)
    if (justFinished()) {
      fireworks.update()
      RERENDER = true
    }
  }

  const onRender = async (): Promise<void> => {
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
        if (showPlayerNames()) {
          // performance:
          // not drawing text directly here, to have less ctx
          // switches between drawImage and fillTxt
          texts.push([`${p.name} (${p.points})`, pos.x, pos.y + CURSOR_H])
        }
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
    updateStatus(ts)
    if (window.DEBUG) Debug.checkpoint('HUD done')
    // ---------------------------------------------------------------

    if (justFinished()) {
      fireworks.render()
    }

    RERENDER = false
  }

  gameLoopInstance = run({
    update: onUpdate,
    render: onRender,
  })

  return {
    setHotkeys: (state: boolean) => {
      evts.setHotkeys(state)
    },
    onBgChange: (value: string) => {
      settings.setStr(SETTINGS.COLOR_BACKGROUND, value)
      evts.addEvent([Protocol.INPUT_EV_BG_COLOR, value])
    },
    onColorChange: (value: string) => {
      settings.setStr(SETTINGS.PLAYER_COLOR, value)
      evts.addEvent([Protocol.INPUT_EV_PLAYER_COLOR, value])
    },
    onNameChange: (value: string) => {
      settings.setStr(SETTINGS.PLAYER_NAME, value)
      evts.addEvent([Protocol.INPUT_EV_PLAYER_NAME, value])
    },
    onSoundsEnabledChange: (value: boolean) => {
      settings.setBool(SETTINGS.SOUND_ENABLED, value)
    },
    onSoundsVolumeChange: (value: number) => {
      settings.setInt(SETTINGS.SOUND_VOLUME, value)
      playClick()
    },
    onShowPlayerNamesChange: (value: boolean) => {
      settings.setBool(SETTINGS.SHOW_PLAYER_NAMES, value)
    },
    replayOnSpeedUp,
    replayOnSpeedDown,
    replayOnPauseToggle,
    previewImageUrl,
    player: {
      background: playerBgColor(),
      color: playerColor(),
      name: playerName(),
      soundsEnabled: playerSoundEnabled(),
      soundsVolume: playerSoundVolume(),
      showPlayerNames: showPlayerNames(),
    },
    game: Game.get(gameId),
    disconnect: Communication.disconnect,
    connect: connect,
    unload: unload,
  }
}
