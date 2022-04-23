"use strict"

import { Emitter, EventType } from 'mitt'
import { GameLoopInstance, run } from './gameloop'
import { Camera, Snapshot } from './Camera'
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
} from '../common/Types'
import EventAdapter from './EventAdapter'
declare global {
  interface Window {
      DEBUG?: boolean
  }
}

const log = logger('game.ts')

// @ts-ignore We can ignore typescript for for binary file includes
const images = import.meta.globEager('./*.png')

// @ts-ignore We can ignore typescript for for binary file includes
const textures = import.meta.globEager('./assets/textures/*.jpg')

// @ts-ignore We can ignore typescript for for binary file includes
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

  const click = sounds['./click.mp3'].default
  const clickOther = sounds['./click2.mp3'].default
  const clickAudio = new Audio(click)
  const clickOtherAudio = new Audio(clickOther)

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

  const canvas = TARGET_EL

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
  const viewport = new Camera()

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
  const evts = EventAdapter(canvas, window, viewport, MODE)
  evts.registerEvents()

  const handleViewportSnapshot = (slot: string): string | null => {
    if (viewportSnapshots['last'] && viewportToggleSlot === slot) {
      const prev = viewport.snapshot()
      const curr = viewportSnapshots['last']
      viewport.fromSnapshot(curr)
      evts.createSnapshotEvents(prev, curr)
      delete viewportSnapshots['last']
      return 'last'
    } else if (viewportSnapshots[slot]) {
      const curr = viewportSnapshots[slot]
      const prev = viewport.snapshot()
      viewportSnapshots['last'] = prev
      viewportToggleSlot = slot
      viewport.fromSnapshot(curr)
      evts.createSnapshotEvents(prev, curr)
      return slot
    } else {
      return null
    }
  }

  centerPuzzle()
  viewportSnapshots['center'] = viewport.snapshot()

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
  const otherPlayerClickSoundEnabled = (): boolean => {
    return settings.getBool(SETTINGS.OTHER_PLAYER_CLICK_SOUND_ENABLED, DEFAULTS.OTHER_PLAYER_CLICK_SOUND_ENABLED)
  }
  const playerSoundEnabled = (): boolean => {
    return settings.getBool(SETTINGS.SOUND_ENABLED, DEFAULTS.SOUND_ENABLED)
  }
  const showPlayerNames = (): boolean => {
    return settings.getBool(SETTINGS.SHOW_PLAYER_NAMES, DEFAULTS.SHOW_PLAYER_NAMES)
  }
  const playerShowTable = (): boolean => {
    return settings.getBool(SETTINGS.SHOW_TABLE, DEFAULTS.SHOW_TABLE)
  }
  const playerTableTexture = (): string => {
    return settings.getStr(SETTINGS.TABLE_TEXTURE, DEFAULTS.TABLE_TEXTURE)
  }
  const playerBgColor = (): string => {
    if (MODE === MODE_REPLAY) {
      return settings.getStr(SETTINGS.COLOR_BACKGROUND, DEFAULTS.COLOR_BACKGROUND)
    }
    return Game.getPlayerBgColor(gameId, clientId)
        || settings.getStr(SETTINGS.COLOR_BACKGROUND, DEFAULTS.COLOR_BACKGROUND)
  }
  const playerColor = (): string => {
    if (MODE === MODE_REPLAY) {
      return settings.getStr(SETTINGS.PLAYER_COLOR, DEFAULTS.PLAYER_COLOR)
    }
    return Game.getPlayerColor(gameId, clientId)
        || settings.getStr(SETTINGS.PLAYER_COLOR, DEFAULTS.PLAYER_COLOR)
  }
  const playerName = (): string => {
    if (MODE === MODE_REPLAY) {
      return settings.getStr(SETTINGS.PLAYER_NAME, DEFAULTS.PLAYER_NAME)
    }
    return Game.getPlayerName(gameId, clientId)
        || settings.getStr(SETTINGS.PLAYER_NAME, DEFAULTS.PLAYER_NAME)
  }

  const playClick = () => {
    const vol = playerSoundVolume()
    clickAudio.volume = vol / 100
    clickAudio.play()
  }

  const playOtherClick = () => {
    const vol = playerSoundVolume()
    clickOtherAudio.volume = vol / 100
    clickOtherAudio.play()
  }

  const player = {
    background: playerBgColor(),
    showTable: playerShowTable(),
    tableTexture: playerTableTexture(),
    color: playerColor(),
    name: playerName(),
    soundsEnabled: playerSoundEnabled(),
    otherPlayerClickSoundEnabled: otherPlayerClickSoundEnabled(),
    soundsVolume: playerSoundVolume(),
    showPlayerNames: showPlayerNames(),
  }
  evts.addEvent([Protocol.INPUT_EV_BG_COLOR, player.background])
  evts.addEvent([Protocol.INPUT_EV_PLAYER_COLOR, player.color])
  evts.addEvent([Protocol.INPUT_EV_PLAYER_NAME, player.name])

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

  let _preview = false
  const togglePreview = () => {
    _preview = !_preview
    eventBus.emit('togglePreview', _preview)
  }
  const toggleSoundsEnabled = () => {
    player.soundsEnabled = !player.soundsEnabled
    const value = player.soundsEnabled
    eventBus.emit('toggleSoundsEnabled', value)
    settings.setBool(SETTINGS.SOUND_ENABLED, value)
    showStatusMessage('Sounds', value)
  }
  const togglePlayerNames = () => {
    player.showPlayerNames = !player.showPlayerNames
    const value = player.showPlayerNames
    eventBus.emit('togglePlayerNames', value)
    settings.setBool(SETTINGS.SHOW_PLAYER_NAMES, value)
    showStatusMessage('Player names', value)
  }
  const toggleShowTable = () => {
    player.showTable = !player.showTable
    const value = player.showTable
    eventBus.emit('toggleShowTable', value)
    settings.setBool(SETTINGS.SHOW_TABLE, value)
    showStatusMessage('Table', value)
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
    if (_preview !== value) {
      _preview = value
    }
  })
  eventBus.on('onBgChange', (value: any) => {
    if (player.background !== value) {
      player.background = value
      settings.setStr(SETTINGS.COLOR_BACKGROUND, value)
      evts.addEvent([Protocol.INPUT_EV_BG_COLOR, value])
      showStatusMessage('Background', value)
    }
  })
  eventBus.on('onTableTextureChange', (value: any) => {
    if (player.tableTexture !== value) {
      player.tableTexture = value
      settings.setStr(SETTINGS.TABLE_TEXTURE, value)
      showStatusMessage('Table texture', value)
      RERENDER = true
    }
  })
  eventBus.on('onShowTableChange', (value: any) => {
    if (player.showTable !== value) {
      player.showTable = value
      settings.setStr(SETTINGS.SHOW_TABLE, value)
      showStatusMessage('Table', value)
      RERENDER = true
    }
  })
  eventBus.on('onColorChange', (value: any) => {
    if (player.color !== value) {
      player.color = value
      settings.setStr(SETTINGS.PLAYER_COLOR, value)
      evts.addEvent([Protocol.INPUT_EV_PLAYER_COLOR, value])
      showStatusMessage('Color', value)
    }
  })
  eventBus.on('onNameChange', (value: any) => {
    if (player.name !== value) {
      player.name = value
      settings.setStr(SETTINGS.PLAYER_NAME, value)
      evts.addEvent([Protocol.INPUT_EV_PLAYER_NAME, value])
      showStatusMessage('Name', value)
    }
  })
  eventBus.on('onOtherPlayerClickSoundEnabledChange', (value: any) => {
    if (player.otherPlayerClickSoundEnabled !== value) {
      player.otherPlayerClickSoundEnabled = value
      settings.setBool(SETTINGS.OTHER_PLAYER_CLICK_SOUND_ENABLED, value)
      showStatusMessage('Other player sounds', value)
    }
  })
  eventBus.on('onSoundsEnabledChange', (value: any) => {
    if (player.soundsEnabled !== value) {
      player.soundsEnabled = value
      settings.setBool(SETTINGS.SOUND_ENABLED, value)
      showStatusMessage('Sounds', value)
    }
  })
  eventBus.on('onSoundsVolumeChange', (value: any) => {
    if (player.soundsVolume !== value) {
      player.soundsVolume = value
      settings.setInt(SETTINGS.SOUND_VOLUME, value)
      playClick()
      showStatusMessage('Volume', value)
    }
  })
  eventBus.on('onShowPlayerNamesChange', (value: any) => {
    if (player.showPlayerNames !== value) {
      player.showPlayerNames = value
      settings.setBool(SETTINGS.SHOW_PLAYER_NAMES, value)
      showStatusMessage('Player names', value)
    }
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
      if (otherPlayerPiecesConnected && playerSoundEnabled() && otherPlayerClickSoundEnabled()) {
        playOtherClick()
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
            const currTs: Timestamp = GAME_TS + currLogEntry[currLogEntry.length - 1]

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
      updateStatus(TIME())

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
          delete viewportSnapshots['last']
        } else if (type === Protocol.INPUT_EV_MOUSE_MOVE) {
          const down = evt[5]
          if (down && !Game.getFirstOwnedPiece(gameId, clientId)) {
            // move the cam
            const diff = viewport.worldDimToViewportRaw({ w: evt[3], h: evt[4] })
            RERENDER = true
            viewport.move(diff.w, diff.h)
            delete viewportSnapshots['last']
          }
        } else if (type === Protocol.INPUT_EV_PLAYER_COLOR) {
          updatePlayerCursorColor(evt[1])
        } else if (type === Protocol.INPUT_EV_MOUSE_DOWN) {
          updatePlayerCursorState(true)
        } else if (type === Protocol.INPUT_EV_MOUSE_UP) {
          updatePlayerCursorState(false)
        } else if (type === Protocol.INPUT_EV_ZOOM_IN) {
          const pos = { x: evt[1], y: evt[2] }
          RERENDER = true
          viewport.zoom('in', viewport.worldToViewportRaw(pos))
          delete viewportSnapshots['last']
        } else if (type === Protocol.INPUT_EV_ZOOM_OUT) {
          const pos = { x: evt[1], y: evt[2] }
          RERENDER = true
          viewport.zoom('out', viewport.worldToViewportRaw(pos))
          delete viewportSnapshots['last']
        } else if (type === Protocol.INPUT_EV_TOGGLE_PREVIEW) {
          togglePreview()
        } else if (type === Protocol.INPUT_EV_TOGGLE_SOUNDS) {
          toggleSoundsEnabled()
        } else if (type === Protocol.INPUT_EV_TOGGLE_PLAYER_NAMES) {
          togglePlayerNames()
        } else if (type === Protocol.INPUT_EV_CENTER_FIT_PUZZLE) {
          const slot = 'center'
          const handled = handleViewportSnapshot(slot)
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
          toggleShowTable()
        } else if (type === Protocol.INPUT_EV_STORE_POS) {
          const slot: string = `${evt[1]}`
          viewportSnapshots[slot] = viewport.snapshot()
          showStatusMessage(`Stored position ${slot}`)
        } else if (type === Protocol.INPUT_EV_RESTORE_POS) {
          const slot: string = `${evt[1]}`
          const handled = handleViewportSnapshot(slot)
          showStatusMessage(handled ? `Restored position "${handled}"` : `Position "${slot}" not set`)
        }

        // LOCAL + SERVER CHANGES
        // -------------------------------------------------------------
        const ts = TIME()
        const changes = Game.handleInput(gameId, clientId, evt, ts)
        if (playerSoundEnabled()) {
          if (changes.find(change => change[0] === Protocol.PLAYER_SNAP)) {
            playClick()
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
          updatePlayerCursorColor(evt[1])
        } else if (type === Protocol.INPUT_EV_MOUSE_DOWN) {
          updatePlayerCursorState(true)
        } else if (type === Protocol.INPUT_EV_MOUSE_UP) {
          updatePlayerCursorState(false)
        } else if (type === Protocol.INPUT_EV_ZOOM_IN) {
          const pos = { x: evt[1], y: evt[2] }
          RERENDER = true
          viewport.zoom('in', viewport.worldToViewportRaw(pos))
        } else if (type === Protocol.INPUT_EV_ZOOM_OUT) {
          const pos = { x: evt[1], y: evt[2] }
          RERENDER = true
          viewport.zoom('out', viewport.worldToViewportRaw(pos))
        } else if (type === Protocol.INPUT_EV_TOGGLE_PREVIEW) {
          togglePreview()
        } else if (type === Protocol.INPUT_EV_TOGGLE_SOUNDS) {
          toggleSoundsEnabled()
        } else if (type === Protocol.INPUT_EV_TOGGLE_PLAYER_NAMES) {
          togglePlayerNames()
        } else if (type === Protocol.INPUT_EV_CENTER_FIT_PUZZLE) {
          const slot = 'center'
          const handled = handleViewportSnapshot(slot)
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
          toggleShowTable()
        } else if (type === Protocol.INPUT_EV_STORE_POS) {
          const slot: string = `${evt[1]}`
          viewportSnapshots[slot] = viewport.snapshot()
          showStatusMessage(`Stored position ${slot}`)
        } else if (type === Protocol.INPUT_EV_RESTORE_POS) {
          const slot: string = `${evt[1]}`
          const handled = handleViewportSnapshot(slot)
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

  const matrix = new DOMMatrix([1, 0, 0, 1, 0, 0])

  const tableImgs: Record<string, CanvasImageSource> = {
    dark: await Graphics.loadImageToBitmap(textures['./assets/textures/wood-dark.jpg'].default),
    light: await Graphics.loadImageToBitmap(textures['./assets/textures/wood-light.jpg'].default),
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

    if (player.showTable) {
      const tableImg = tableImgs[player.tableTexture]
      if (tableImg) {
        const bounds = Game.getBounds(gameId)
        pos = viewport.worldToViewportRaw(bounds)
        dim = viewport.worldDimToViewportRaw(bounds)

        const pat = ctx.createPattern(tableImg, 'repeat') as CanvasPattern
        pat.setTransform(matrix.translate(pos.x, pos.y).scale(viewport.getCurrentZoom()*3))
        ctx.fillStyle = pat
        ctx.fillRect(pos.x, pos.y, dim.w, dim.h)

        // darken the outer edges of the table a bit
        const border = viewport.worldDimToViewportRaw({w: 16, h: 16})
        ctx.fillStyle = 'rgba(0, 0, 0, .5)'
        ctx.fillRect(pos.x, pos.y, dim.w, border.h)
        ctx.fillRect(pos.x, pos.y + border.h, border.w, dim.h - 2 * border.h)
        ctx.fillRect(pos.x + dim.w - border.w, pos.y + border.h, border.w, dim.h - 2 * border.h)
        ctx.fillRect(pos.x, pos.y + dim.h - border.h, dim.w, border.w)
      }
    }

    if (window.DEBUG) Debug.checkpoint('clear done')
    // ---------------------------------------------------------------


    // DRAW BOARD
    // ---------------------------------------------------------------
    pos = viewport.worldToViewportRaw(BOARD_POS)
    dim = viewport.worldDimToViewportRaw(BOARD_DIM)
    if (player.showTable) {
      // darken the place where the puzzle should be at the end a bit
      const border = viewport.worldDimToViewportRaw({w: 8, h: 8})
      ctx.fillStyle = 'rgba(0, 0, 0, .5)'
      ctx.fillRect(pos.x - border.w, pos.y - border.h, dim.w + 2 * border.w, border.h)
      ctx.fillRect(pos.x - border.w, pos.y, border.h, dim.h)
      ctx.fillRect(pos.x + dim.w, pos.y, border.w, dim.h)
      ctx.fillRect(pos.x - border.w, pos.y + dim.h, dim.w + 2 * border.w, border.h)
    }
    if (player.showTable && player.tableTexture === 'dark') {
      ctx.fillStyle = 'rgba(0, 0, 0, .3)'
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, .3)'
    }
    ctx.fillRect(pos.x, pos.y, dim.w, dim.h)
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
    player: player,
    game: Game.get(gameId),
    disconnect: Communication.disconnect,
    connect: connect,
    unload: unload,
  }
}
