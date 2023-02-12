"use strict"

import { Emitter, EventType } from 'mitt'
import { GameLoopInstance, run } from './gameloop'
import { Camera } from './Camera'
import Debug from './Debug'
import Communication from './Communication'
import Util, { logger } from './../common/Util'
import PuzzleGraphics from './PuzzleGraphics'
import Game from './../common/GameCommon'
import fireworksController from './Fireworks'
import Protocol from '../common/Protocol'
import Time from '../common/Time'
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
} from '../common/Types'
import { Assets } from './Assets'
import { EventAdapter } from './EventAdapter'
import { PuzzleTable } from './PuzzleTable'
import { ViewportSnapshots } from './ViewportSnapshots'
import { PlayerSettings } from './PlayerSettings'
import { Sounds } from './Sounds'
import { PuzzleStatus } from './PuzzleStatus'
import { PlayerCursors } from './PlayerCursors'
import _api from './_api'
declare global {
  interface Window {
      DEBUG?: boolean
  }
}

const log = logger('game.ts')

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

export async function main(
  gameId: string,
  clientId: string,
  wsAddress: string,
  MODE: string,
  TARGET_EL: HTMLCanvasElement,
  eventBus: Emitter<Record<EventType, unknown>>,
) {
  if (typeof window.DEBUG === 'undefined') window.DEBUG = false

  const shouldDrawPlayer = (player: Player) => {
    return MODE === MODE_REPLAY || player.id !== clientId
  }

  const assets = new Assets()
  await assets.init()

  const canvas = TARGET_EL

  const playerCursors = new PlayerCursors(canvas, assets)

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
  ): Promise<ReplayData | null> => {
    const offset = REPLAY.dataOffset
    REPLAY.dataOffset += 10000 // meh

    const res = await _api.pub.replayData({ gameId, offset })
    if (res.status !== 200) {
      throw new Error('Replay not found')
    }
    const replay: ReplayData = await res.json() as ReplayData

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
      const replay: ReplayData | null = await queryNextReplayBatch(gameId)
      if (!replay) {
        throw '[ 2023-02-12 no replay data received ]'
      }
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

  const bounds = Game.getBounds(gameId)
  const puzzleTable = new PuzzleTable(bounds, assets, BOARD_POS, BOARD_DIM)
  await puzzleTable.init()

  const bitmaps = await PuzzleGraphics.loadPuzzleBitmaps(
    Game.getPuzzle(gameId),
    Game.getImageUrl(gameId),
  )

  const viewport = new Camera()
  const evts = new EventAdapter(canvas, window, viewport, MODE)
  const viewportSnapshots = new ViewportSnapshots(evts, viewport)
  const playerSettings = new PlayerSettings(MODE, gameId, clientId, eventBus)
  playerSettings.init()
  const sounds = new Sounds(assets, playerSettings)

  const fireworks = new fireworksController(canvas, Game.getRng(gameId))
  fireworks.init()

  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  canvas.classList.add('loaded')
  eventBus.emit('puzzleCut')

  // initialize some view data
  // this global data will change according to input events

  // theoretically we need to recalculate this when window resizes
  // but it probably doesnt matter so much
  viewport.calculateZoomCapping(
    window.innerWidth,
    window.innerHeight,
    TABLE_WIDTH,
    TABLE_HEIGHT,
  )

  const centerPuzzle = () => {
    // center on the puzzle
    viewport.reset()
    viewport.move(
      -(TABLE_WIDTH - canvas.width) /2,
      -(TABLE_HEIGHT - canvas.height) /2
    )

    // zoom viewport to fit whole puzzle in
    const x = viewport.worldDimToViewportRaw(BOARD_DIM)
    const border = 20
    const targetW = canvas.width - (border * 2)
    const targetH = canvas.height - (border * 2)
    if (
      (x.w > targetW || x.h > targetH)
      || (x.w < targetW && x.h < targetH)
    ) {
      const zoom = Math.min(targetW / x.w, targetH / x.h)
      const center = { x: canvas.width / 2, y: canvas.height / 2 }
      viewport.setZoom(zoom, center)
    }
  }
  evts.registerEvents()

  centerPuzzle()
  viewportSnapshots.snap('center')

  const previewImageUrl = Game.getImageUrl(gameId)

  const puzzleStatus = new PuzzleStatus(gameId, eventBus)
  puzzleStatus.update(TIME())

  const longFinished = !! Game.getFinishTs(gameId)
  let finished = longFinished
  const justFinished = () => finished && !longFinished

  evts.addEvent([Protocol.INPUT_EV_BG_COLOR, playerSettings.background()])
  evts.addEvent([Protocol.INPUT_EV_PLAYER_COLOR, playerSettings.color()])
  evts.addEvent([Protocol.INPUT_EV_PLAYER_NAME, playerSettings.name()])

  playerCursors.updatePlayerCursorColor(playerSettings.color())
  const doSetSpeedStatus = () => {
    eventBus.emit('replaySpeed', REPLAY.speeds[REPLAY.speedIdx])
    eventBus.emit('replayPaused', REPLAY.paused)
  }

  const showStatusMessage = (what: string, value: any = undefined) => {
    eventBus.emit('statusMessage', { what, value })
  }

  const replayOnSpeedUp = () => {
    if (REPLAY.speedIdx + 1 < REPLAY.speeds.length) {
      REPLAY.speedIdx++
      doSetSpeedStatus()
      showStatusMessage('Speed Up')
    }
  }
  const replayOnSpeedDown = () => {
    if (REPLAY.speedIdx >= 1) {
      REPLAY.speedIdx--
      doSetSpeedStatus()
      showStatusMessage('Speed Down')
    }
  }
  const replayOnPauseToggle = () => {
    REPLAY.paused = !REPLAY.paused
    doSetSpeedStatus()
    showStatusMessage(REPLAY.paused ? 'Paused' : 'Playing')
  }

  let isInterfaceVisible = true
  const toggleInterface = () => {
    isInterfaceVisible = !isInterfaceVisible
    eventBus.emit('toggleInterface', isInterfaceVisible)
    showStatusMessage('Interface', isInterfaceVisible)
  }

  let isPreviewVisible = false
  const togglePreview = () => {
    isPreviewVisible = !isPreviewVisible
    eventBus.emit('togglePreview', isPreviewVisible)
  }

  eventBus.on('replayOnSpeedUp', () => {
    replayOnSpeedUp()
  })
  eventBus.on('replayOnSpeedDown', () => {
    replayOnSpeedDown()
  })
  eventBus.on('replayOnPauseToggle', () => {
    replayOnPauseToggle()
  })
  eventBus.on('onPreviewChange', (value: any) => {
    if (isPreviewVisible !== value) {
      isPreviewVisible = value
    }
  })
  eventBus.on('onBgChange', (value: any) => {
    evts.addEvent([Protocol.INPUT_EV_BG_COLOR, value])
  })
  eventBus.on('onTableTextureChange', () => {
    RERENDER = true
  })
  eventBus.on('onShowTableChange', () => {
    RERENDER = true
  })
  eventBus.on('onColorChange', (value: any) => {
    evts.addEvent([Protocol.INPUT_EV_PLAYER_COLOR, value])
  })
  eventBus.on('onNameChange', (value: any) => {
    evts.addEvent([Protocol.INPUT_EV_PLAYER_NAME, value])
  })
  eventBus.on('onSoundsVolumeChange', () => {
    sounds.playPieceConnected()
  })
  eventBus.on('setHotkeys', (state: any) => {
    evts.setHotkeys(state)
  })
  eventBus.on('requireRerender', () => {
    RERENDER = true
  })

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

  if (MODE === MODE_PLAY) {
    intervals.push(setInterval(() => {
      puzzleStatus.update(TIME())
    }, 1000))
  } else if (MODE === MODE_REPLAY) {
    doSetSpeedStatus()
  }

  if (MODE === MODE_PLAY) {
    Communication.onServerChange((msg: ServerEvent) => {
      const _msgType = msg[0]
      const _evClientId = msg[1]
      const _evClientSeq = msg[2]
      const evChanges = msg[3]

      let rerender: boolean = false;
      let otherPlayerPiecesConnected: boolean = false;

      for (const [changeType, changeData] of evChanges) {
        switch (changeType) {
          case Protocol.CHANGE_PLAYER: {
            const p = Util.decodePlayer(changeData)
            if (p.id !== clientId) {
              Game.setPlayer(gameId, p.id, p)
              rerender = true
            }
          } break;
          case Protocol.CHANGE_PIECE: {
            const piece = Util.decodePiece(changeData)
            Game.setPiece(gameId, piece.idx, piece)
            rerender = true
          } break;
          case Protocol.CHANGE_DATA: {
            Game.setPuzzleData(gameId, changeData)
            rerender = true
          } break;
          case Protocol.PLAYER_SNAP: {
            const snapPlayerId = changeData
            if (snapPlayerId !== clientId) {
              otherPlayerPiecesConnected = true
            }
          } break;
        }
      }
      if (
        otherPlayerPiecesConnected
        && playerSettings.soundsEnabled()
        && playerSettings.otherPlayerClickSoundEnabled()
      ) {
        sounds.playOtherPieceConnected()
      }
      if (rerender) {
        RERENDER = true
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

      let continueLoop: boolean = true
      do {
        if (REPLAY.paused) {
          continueLoop = false
        } else {
          const nextIdx = REPLAY.logPointer + 1
          if (nextIdx >= REPLAY.log.length) {
            continueLoop = false
          } else {

            const currLogEntry = REPLAY.log[REPLAY.logPointer]
            const currTs: Timestamp = GAME_TS + (
              currLogEntry[0] === Protocol.LOG_HEADER
              ? 0
              : currLogEntry[currLogEntry.length - 1]
            )

            const nextLogEntry = REPLAY.log[nextIdx]
            const diffToNext = nextLogEntry[nextLogEntry.length - 1]
            const nextTs: Timestamp = currTs + diffToNext
            if (nextTs > maxGameTs) {
              // next log entry is too far into the future
              if (REPLAY.skipNonActionPhases && (maxGameTs + 500 * Time.MS < nextTs)) {
                maxGameTs += diffToNext
              }
              continueLoop = false
            } else {
              GAME_TS = currTs
              if (handleLogEntry(nextLogEntry, nextTs)) {
                RERENDER = true
              }
              REPLAY.logPointer = nextIdx
            }
          }
        }
      } while (continueLoop)
      REPLAY.lastRealTs = realTs
      REPLAY.lastGameTs = maxGameTs
      puzzleStatus.update(TIME())

      if (!REPLAY.final) {
        to = setTimeout(next, 50)
      }
    }

    next()
  }

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
          const dim = viewport.worldDimToViewportRaw({ w: evt[1], h: evt[2] })
          RERENDER = true
          viewport.move(dim.w, dim.h)
          viewportSnapshots.remove(ViewportSnapshots.LAST)
        } else if (type === Protocol.INPUT_EV_MOUSE_MOVE) {
          const down = evt[5]
          if (down && !Game.getFirstOwnedPiece(gameId, clientId)) {
            // move the cam
            const diff = viewport.worldDimToViewportRaw({ w: evt[3], h: evt[4] })
            RERENDER = true
            viewport.move(diff.w, diff.h)
            viewportSnapshots.remove(ViewportSnapshots.LAST)
          }
        } else if (type === Protocol.INPUT_EV_PLAYER_COLOR) {
          playerCursors.updatePlayerCursorColor(evt[1])
        } else if (type === Protocol.INPUT_EV_MOUSE_DOWN) {
          playerCursors.updatePlayerCursorState(true)
        } else if (type === Protocol.INPUT_EV_MOUSE_UP) {
          playerCursors.updatePlayerCursorState(false)
        } else if (type === Protocol.INPUT_EV_ZOOM_IN) {
          const pos = { x: evt[1], y: evt[2] }
          RERENDER = true
          viewport.zoom('in', viewport.worldToViewportRaw(pos))
          viewportSnapshots.remove(ViewportSnapshots.LAST)
        } else if (type === Protocol.INPUT_EV_ZOOM_OUT) {
          const pos = { x: evt[1], y: evt[2] }
          RERENDER = true
          viewport.zoom('out', viewport.worldToViewportRaw(pos))
          viewportSnapshots.remove(ViewportSnapshots.LAST)
        } else if (type === Protocol.INPUT_EV_TOGGLE_INTERFACE) {
          toggleInterface()
        } else if (type === Protocol.INPUT_EV_TOGGLE_PREVIEW) {
          togglePreview()
        } else if (type === Protocol.INPUT_EV_TOGGLE_SOUNDS) {
          playerSettings.toggleSoundsEnabled()
        } else if (type === Protocol.INPUT_EV_TOGGLE_PLAYER_NAMES) {
          playerSettings.togglePlayerNames()
        } else if (type === Protocol.INPUT_EV_CENTER_FIT_PUZZLE) {
          const slot = 'center'
          const handled = viewportSnapshots.handle(slot)
          showStatusMessage(handled ? `Restored position "${handled}"` : `Position "${slot}" not set`)
        } else if (type === Protocol.INPUT_EV_TOGGLE_FIXED_PIECES) {
          PIECE_VIEW_FIXED = !PIECE_VIEW_FIXED
          showStatusMessage(`${PIECE_VIEW_FIXED ? 'Showing' : 'Hiding'} finished pieces`)
          RERENDER = true
        } else if (type === Protocol.INPUT_EV_TOGGLE_LOOSE_PIECES) {
          PIECE_VIEW_LOOSE = !PIECE_VIEW_LOOSE
          showStatusMessage(`${PIECE_VIEW_LOOSE ? 'Showing' : 'Hiding'} unfinished pieces`)
          RERENDER = true
        } else if (type === Protocol.INPUT_EV_TOGGLE_TABLE) {
          playerSettings.toggleShowTable()
        } else if (type === Protocol.INPUT_EV_STORE_POS) {
          const slot: string = `${evt[1]}`
          viewportSnapshots.snap(slot)
          showStatusMessage(`Stored position ${slot}`)
        } else if (type === Protocol.INPUT_EV_RESTORE_POS) {
          const slot: string = `${evt[1]}`
          const handled = viewportSnapshots.handle(slot)
          showStatusMessage(handled ? `Restored position "${handled}"` : `Position "${slot}" not set`)
        }

        // LOCAL + SERVER CHANGES
        // -------------------------------------------------------------
        const ts = TIME()
        const changes = Game.handleInput(gameId, clientId, evt, ts)
        if (playerSettings.soundsEnabled()) {
          if (changes.find(change => change[0] === Protocol.PLAYER_SNAP)) {
            sounds.playPieceConnected()
          }
        }
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
          const dim = viewport.worldDimToViewportRaw({ w: evt[1], h: evt[2] })
          RERENDER = true
          viewport.move(dim.w, dim.h)
        } else if (type === Protocol.INPUT_EV_MOUSE_MOVE) {
          const down = evt[5]
          if (down) {
            const diff = viewport.worldDimToViewportRaw({ w: evt[3], h: evt[4] })
            RERENDER = true
            viewport.move(diff.w, diff.h)
          }
        } else if (type === Protocol.INPUT_EV_PLAYER_COLOR) {
          playerCursors.updatePlayerCursorColor(evt[1])
        } else if (type === Protocol.INPUT_EV_MOUSE_DOWN) {
          playerCursors.updatePlayerCursorState(true)
        } else if (type === Protocol.INPUT_EV_MOUSE_UP) {
          playerCursors.updatePlayerCursorState(false)
        } else if (type === Protocol.INPUT_EV_ZOOM_IN) {
          const pos = { x: evt[1], y: evt[2] }
          RERENDER = true
          viewport.zoom('in', viewport.worldToViewportRaw(pos))
        } else if (type === Protocol.INPUT_EV_ZOOM_OUT) {
          const pos = { x: evt[1], y: evt[2] }
          RERENDER = true
          viewport.zoom('out', viewport.worldToViewportRaw(pos))
        } else if (type === Protocol.INPUT_EV_TOGGLE_INTERFACE) {
          toggleInterface()
        } else if (type === Protocol.INPUT_EV_TOGGLE_PREVIEW) {
          togglePreview()
        } else if (type === Protocol.INPUT_EV_TOGGLE_SOUNDS) {
          playerSettings.toggleSoundsEnabled()
        } else if (type === Protocol.INPUT_EV_TOGGLE_PLAYER_NAMES) {
          playerSettings.togglePlayerNames()
        } else if (type === Protocol.INPUT_EV_CENTER_FIT_PUZZLE) {
          const slot = 'center'
          const handled = viewportSnapshots.handle(slot)
          showStatusMessage(handled ? `Restored position "${handled}"` : `Position "${slot}" not set`)
        } else if (type === Protocol.INPUT_EV_TOGGLE_FIXED_PIECES) {
          PIECE_VIEW_FIXED = !PIECE_VIEW_FIXED
          showStatusMessage(`${PIECE_VIEW_FIXED ? 'Showing' : 'Hiding'} finished pieces`)
          RERENDER = true
        } else if (type === Protocol.INPUT_EV_TOGGLE_LOOSE_PIECES) {
          PIECE_VIEW_LOOSE = !PIECE_VIEW_LOOSE
          showStatusMessage(`${PIECE_VIEW_LOOSE ? 'Showing' : 'Hiding'} unfinished pieces`)
          RERENDER = true
        } else if (type === Protocol.INPUT_EV_TOGGLE_TABLE) {
          playerSettings.toggleShowTable()
        } else if (type === Protocol.INPUT_EV_STORE_POS) {
          const slot: string = `${evt[1]}`
          viewportSnapshots.snap(slot)
          showStatusMessage(`Stored position ${slot}`)
        } else if (type === Protocol.INPUT_EV_RESTORE_POS) {
          const slot: string = `${evt[1]}`
          const handled = viewportSnapshots.handle(slot)
          showStatusMessage(handled ? `Restored position "${handled}"` : `Position "${slot}" not set`)
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
    ctx.fillStyle = playerSettings.background()
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    if (window.DEBUG) Debug.checkpoint('clear done')
    // ---------------------------------------------------------------


    // DRAW TABLE
    // ---------------------------------------------------------------
    if (playerSettings.showTable()) {
      const tableImg = puzzleTable.getImage(playerSettings.tableTexture())
      if (tableImg) {
        pos = viewport.worldToViewportRaw(bounds)
        dim = viewport.worldDimToViewportRaw(bounds)
        ctx.drawImage(tableImg, pos.x, pos.y, dim.w, dim.h)
      }
    }
    if (window.DEBUG) Debug.checkpoint('table done')
    // ---------------------------------------------------------------


    // DRAW BOARD
    // ---------------------------------------------------------------
    if (!playerSettings.showTable()) {
      pos = viewport.worldToViewportRaw(BOARD_POS)
      dim = viewport.worldDimToViewportRaw(BOARD_DIM)
      ctx.fillStyle = 'rgba(255, 255, 255, .3)'
      ctx.fillRect(pos.x, pos.y, dim.w, dim.h)
    }
    if (window.DEBUG) Debug.checkpoint('board done')
    // ---------------------------------------------------------------


    // DRAW PIECES
    // ---------------------------------------------------------------
    const pieces = Game.getPiecesSortedByZIndex(gameId)
    if (window.DEBUG) Debug.checkpoint('get pieces done')

    dim = viewport.worldDimToViewportRaw(PIECE_DIM)
    for (const piece of pieces) {
      if (!shouldDrawPiece(piece)) {
        continue
      }
      bmp = bitmaps[piece.idx]
      pos = viewport.worldToViewportRaw({
        x: PIECE_DRAW_OFFSET + piece.pos.x,
        y: PIECE_DRAW_OFFSET + piece.pos.y,
      })
      ctx.drawImage(bmp,
        0, 0, bmp.width, bmp.height,
        pos.x, pos.y, dim.w, dim.h
      )
    }
    if (window.DEBUG) Debug.checkpoint('pieces done')
    // ---------------------------------------------------------------


    // DRAW PLAYERS
    // ---------------------------------------------------------------
    const texts: Array<FixedLengthArray<[string, number, number]>> = []
    // Cursors
    for (const p of Game.getActivePlayers(gameId, ts)) {
      if (shouldDrawPlayer(p)) {
        bmp = await playerCursors.get(p)
        pos = viewport.worldToViewport(p)
        ctx.drawImage(bmp, pos.x - playerCursors.CURSOR_W_2, pos.y - playerCursors.CURSOR_H_2)
        if (playerSettings.showPlayerNames()) {
          // performance:
          // not drawing text directly here, to have less ctx
          // switches between drawImage and fillTxt
          texts.push([`${p.name} (${p.points})`, pos.x, pos.y + playerCursors.CURSOR_H])
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
    puzzleStatus.update(ts)
    if (window.DEBUG) Debug.checkpoint('HUD done')
    // ---------------------------------------------------------------

    if (justFinished()) {
      fireworks.render()
    }

    RERENDER = false
  }

  const gameLoopInstance: GameLoopInstance = run({
    update: onUpdate,
    render: onRender,
  })
  const unload = () => {
    clearIntervals()
    gameLoopInstance.stop()
    if (evts) {
      evts.unregisterEvents()
    }
  }

  return {
    previewImageUrl,
    playerSettings,
    puzzleStatus,
    game: Game.get(gameId),
    disconnect: Communication.disconnect,
    connect: connect,
    unload: unload,
  }
}
