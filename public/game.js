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

if (typeof GAME_ID === 'undefined') throw '[ GAME_ID not set ]'
if (typeof WS_ADDRESS === 'undefined') throw '[ WS_ADDRESS not set ]'
if (typeof MODE === 'undefined') throw '[ MODE not set ]'

if (typeof DEBUG === 'undefined') window.DEBUG = false

const TARGET_EL = document.getElementById('app')

const MODE_PLAY = 'play'
const MODE_REPLAY = 'replay'

let RERENDER = true

let TIME = () => Time.timestamp()

function addCanvasToDom(canvas) {
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

const ELEMENTS = {
  TABLE: document.createElement('table'),
  TR: document.createElement('tr'),
  TD: document.createElement('td'),
  BUTTON: document.createElement('button'),
  INPUT: document.createElement('input'),
  LABEL: document.createElement('label'),
  DIV: document.createElement('div'),
  A: document.createElement('a'),
}

let KEY_LISTENER_OFF = false

let PIECE_VIEW_FIXED = true
let PIECE_VIEW_LOOSE = true

function addMenuToDom(previewImageUrl) {
  function row (...elements) {
    const row = ELEMENTS.TR.cloneNode(true)
    for (let el of elements) {
      const td = ELEMENTS.TD.cloneNode(true)
      if (typeof el === 'string') {
        td.appendChild(document.createTextNode(el))
      } else {
        td.appendChild(el)
      }
      row.appendChild(td)
    }
    return row
  }

  function btn(txt) {
    const btn = ELEMENTS.BUTTON.cloneNode(true)
    btn.classList.add('btn')
    btn.innerText = txt
    return btn
  }

  function colorinput() {
    const input = ELEMENTS.INPUT.cloneNode(true)
    input.type = 'color'
    return input
  }

  function textinput(maxLength) {
    const input = ELEMENTS.INPUT.cloneNode(true)
    input.type = 'text'
    input.maxLength = maxLength
    return input
  }

  function label(text) {
    const label = ELEMENTS.LABEL.cloneNode(true)
    label.innerText = text
    return label
  }

  const bgColorPickerEl = colorinput()
  const bgColorPickerRow = row(label('Background: '), bgColorPickerEl)

  const playerColorPickerEl = colorinput()
  const playerColorPickerRow = row(label('Color: '), playerColorPickerEl)

  const nameChangeEl = textinput(16)
  const nameChangeRow = row(label('Name: '), nameChangeEl)

  const kbd = function(txt) {
    const el = document.createElement('kbd')
    el.appendChild(document.createTextNode(txt))
    return el
  }

  const h = function(...els) {
    const el = ELEMENTS.DIV.cloneNode(true)
    for (const other of els) {
      if (typeof other === 'string') {
        el.appendChild(document.createTextNode(other))
      } else {
        el.appendChild(other)
      }
    }
    return el
  }

  const helpEl = ELEMENTS.TABLE.cloneNode(true)
  helpEl.classList.add('help')
  helpEl.appendChild(row('⬆️ Move up:', h(kbd('W'), '/', kbd('↑'), '/🖱️')))
  helpEl.appendChild(row('⬇️ Move down:', h(kbd('S'), '/', kbd('↓'), '/🖱️')))
  helpEl.appendChild(row('⬅️ Move left:', h(kbd('A'), '/', kbd('←'), '/🖱️')))
  helpEl.appendChild(row('➡️ Move right:', h(kbd('D'), '/', kbd('→'), '/🖱️')))
  helpEl.appendChild(row('', h('Move faster by holding ', kbd('Shift'))))
  helpEl.appendChild(row('🔍+ Zoom in:', h(kbd('E'), '/🖱️-Wheel')))
  helpEl.appendChild(row('🔍- Zoom out:', h(kbd('Q'), '/🖱️-Wheel')))
  helpEl.appendChild(row('🖼️ Toggle preview:', h(kbd('Space'))))
  helpEl.appendChild(row('🧩✔️ Toggle fixed pieces:', h(kbd('F'))))
  helpEl.appendChild(row('🧩❓ Toggle loose pieces:', h(kbd('G'))))
  helpEl.addEventListener('click', (e) => {
    e.stopPropagation()
  })

  const toggle = (el, disableHotkeys = true) => {
    el.classList.toggle('closed')
    if (disableHotkeys) {
      KEY_LISTENER_OFF = !el.classList.contains('closed')
    }
  }

  const helpOverlay = ELEMENTS.DIV.cloneNode(true)
  helpOverlay.classList.add('overlay', 'transparent', 'closed')
  helpOverlay.appendChild(helpEl)
  helpOverlay.addEventListener('click', () => {
    toggle(helpOverlay)
  })

  const settingsEl = ELEMENTS.TABLE.cloneNode(true)
  settingsEl.classList.add('settings')
  settingsEl.appendChild(bgColorPickerRow)
  settingsEl.appendChild(playerColorPickerRow)
  settingsEl.appendChild(nameChangeRow)
  settingsEl.addEventListener('click', (e) => {
    e.stopPropagation()
  })

  const settingsOverlay = ELEMENTS.DIV.cloneNode(true)
  settingsOverlay.classList.add('overlay', 'transparent', 'closed')
  settingsOverlay.appendChild(settingsEl)
  settingsOverlay.addEventListener('click', () => {
    toggle(settingsOverlay)
  })

  const previewEl = ELEMENTS.DIV.cloneNode(true)
  previewEl.classList.add('preview')

  const imgEl = ELEMENTS.DIV.cloneNode(true)
  imgEl.classList.add('img')
  imgEl.style.backgroundImage = `url('${previewImageUrl}')`
  previewEl.appendChild(imgEl)

  const previewOverlay = ELEMENTS.DIV.cloneNode(true)
  previewOverlay.classList.add('overlay', 'closed')
  previewOverlay.appendChild(previewEl)
  const togglePreview = () => {
    previewOverlay.classList.toggle('closed')
  }
  previewOverlay.addEventListener('click', () => {
    togglePreview()
  })

  const opener = (txt, overlay, disableHotkeys = true) => {
    const el = ELEMENTS.DIV.cloneNode(true)
    el.classList.add('opener')
    el.appendChild(document.createTextNode(txt))
    el.addEventListener('click', () => {
      toggle(overlay, disableHotkeys)
    })
    return el
  }

  const homeEl = ELEMENTS.A.cloneNode(true)
  homeEl.classList.add('opener')
  homeEl.appendChild(document.createTextNode('🧩 Puzzles'))
  homeEl.target = '_blank'
  homeEl.href = '/'

  const settingsOpenerEl = opener('🛠️ Settings', settingsOverlay)
  const previewOpenerEl = opener('🖼️ Preview', previewOverlay, false)
  const helpOpenerEl = opener('ℹ️ Help', helpOverlay)

  const tabsEl = ELEMENTS.DIV.cloneNode(true)
  tabsEl.classList.add('tabs')
  tabsEl.appendChild(homeEl)
  tabsEl.appendChild(previewOpenerEl)
  tabsEl.appendChild(settingsOpenerEl)
  tabsEl.appendChild(helpOpenerEl)

  const menuEl = ELEMENTS.DIV.cloneNode(true)
  menuEl.classList.add('menu')
  menuEl.appendChild(tabsEl)

  const scoresTitleEl = ELEMENTS.DIV.cloneNode(true)
  scoresTitleEl.appendChild(document.createTextNode('Scores'))

  const scoresListEl = ELEMENTS.TABLE.cloneNode(true)
  const updateScoreBoard = (players, ts) => {
    const minTs = ts - 30 * Time.SEC

    const actives = players.filter(player => player.ts >= minTs)
    const nonActives = players.filter(player => player.ts < minTs)

    actives.sort((a, b) => b.points - a.points)
    nonActives.sort((a, b) => b.points - a.points)

    scoresListEl.innerHTML = ''
    for (let player of actives) {
      const r = row(
        document.createTextNode('⚡'),
        document.createTextNode(player.name),
        document.createTextNode(player.points)
      )
      r.style.color = player.color
      scoresListEl.appendChild(r)
    }
    for (let player of nonActives) {
      const r = row(
        document.createTextNode('💤'),
        document.createTextNode(player.name),
        document.createTextNode(player.points)
      )
      r.style.color = player.color
      scoresListEl.appendChild(r)
    }
  }

  const timerStr = (started, ended, ts) => {
    const icon = ended ? '🏁' : '⏳'
    const from = started;
    const to = ended || ts
    const timeDiffStr = Time.timeDiffStr(from, to)
    return `${icon} ${timeDiffStr}`
  }

  const timerCountdownEl = ELEMENTS.DIV.cloneNode(true)
  const updateTimer = (started, ended, ts) => {
    timerCountdownEl.innerText = timerStr(started, ended, ts)
  }
  const tilesDoneEl = ELEMENTS.DIV.cloneNode(true)
  const udateTilesDone = (finished, total) => {
    tilesDoneEl.innerText = `🧩 ${finished}/${total}`
  }

  const timerEl = ELEMENTS.DIV.cloneNode(true)
  timerEl.classList.add('timer')
  timerEl.appendChild(tilesDoneEl)
  timerEl.appendChild(timerCountdownEl)

  let replayControl = null
  if (MODE === MODE_REPLAY) {
    const replayControlEl = ELEMENTS.DIV.cloneNode(true)
    const speedUp = btn('⏫')
    const speedDown = btn('⏬')
    const pause = btn('⏸️')
    const speed = ELEMENTS.DIV.cloneNode(true)
    replayControlEl.appendChild(speed)
    replayControlEl.appendChild(speedUp)
    replayControlEl.appendChild(speedDown)
    replayControlEl.appendChild(pause)
    timerEl.appendChild(replayControlEl)
    replayControl = { speedUp, speedDown, pause, speed }
  }

  const scoresEl = ELEMENTS.DIV.cloneNode(true)
  scoresEl.classList.add('scores')
  scoresEl.appendChild(scoresTitleEl)
  scoresEl.appendChild(scoresListEl)

  TARGET_EL.appendChild(settingsOverlay)
  TARGET_EL.appendChild(previewOverlay)
  TARGET_EL.appendChild(helpOverlay)
  TARGET_EL.appendChild(timerEl)
  TARGET_EL.appendChild(menuEl)
  TARGET_EL.appendChild(scoresEl)

  return {
    bgColorPickerEl,
    playerColorPickerEl,
    nameChangeEl,
    updateScoreBoard,
    updateTimer,
    udateTilesDone,
    togglePreview,
    replayControl,
  }
}

function initme() {
  // return uniqId()
  let ID = localStorage.getItem('ID')
  if (!ID) {
    ID = Util.uniqId()
    localStorage.setItem('ID', ID)
  }
  return ID
}

class EventAdapter {
  constructor(canvas, window, viewport) {
    this.events = []
    this._viewport = viewport
    this._canvas = canvas

    this.LEFT = false
    this.RIGHT = false
    this.UP = false
    this.DOWN = false
    this.ZOOM_IN = false
    this.ZOOM_OUT = false
    this.SHIFT = false

    canvas.addEventListener('mousedown', this._mouseDown.bind(this))
    canvas.addEventListener('mouseup', this._mouseUp.bind(this))
    canvas.addEventListener('mousemove', this._mouseMove.bind(this))
    canvas.addEventListener('wheel', this._wheel.bind(this))

    window.addEventListener('keydown', (ev) => {
      if (KEY_LISTENER_OFF) {
        return
      }
      if (ev.key === 'Shift') {
        this.SHIFT = true
      } else if (ev.key === 'ArrowUp' || ev.key === 'w' || ev.key === 'W') {
        this.UP = true
      } else if (ev.key === 'ArrowDown' || ev.key === 's' || ev.key === 'S') {
        this.DOWN = true
      } else if (ev.key === 'ArrowLeft' || ev.key === 'a' || ev.key === 'A') {
        this.LEFT = true
      } else if (ev.key === 'ArrowRight' || ev.key === 'd' || ev.key === 'D') {
        this.RIGHT = true
      } else if (ev.key === 'q') {
        this.ZOOM_OUT = true
      } else if (ev.key === 'e') {
        this.ZOOM_IN = true
      }
    })
    window.addEventListener('keyup', (ev) => {
      if (KEY_LISTENER_OFF) {
        return
      }
      if (ev.key === 'Shift') {
        this.SHIFT = false
      } else if (ev.key === 'ArrowUp' || ev.key === 'w' || ev.key === 'W') {
        this.UP = false
      } else if (ev.key === 'ArrowDown' || ev.key === 's' || ev.key === 'S') {
        this.DOWN = false
      } else if (ev.key === 'ArrowLeft' || ev.key === 'a' || ev.key === 'A') {
        this.LEFT = false
      } else if (ev.key === 'ArrowRight' || ev.key === 'd' || ev.key === 'D') {
        this.RIGHT = false
      } else if (ev.key === 'q') {
        this.ZOOM_OUT = false
      } else if (ev.key === 'e') {
        this.ZOOM_IN = false
      }
    })
  }

  addEvent(event) {
    this.events.push(event)
  }

  consumeAll() {
    if (this.events.length === 0) {
      return []
    }
    const all = this.events.slice()
    this.events = []
    return all
  }

  _keydowns() {
    let amount = this.SHIFT ? 20 : 10
    let x = 0
    let y = 0
    if (this.UP) {
      y += amount
    }
    if (this.DOWN) {
      y -= amount
    }
    if (this.LEFT) {
      x += amount
    }
    if (this.RIGHT) {
      x -= amount
    }

    if (x !== 0 || y !== 0) {
      this.addEvent([Protocol.INPUT_EV_MOVE, x, y])
    }

    // zoom keys
    const pos = this._viewport.viewportToWorld({
      x: this._canvas.width / 2,
      y: this._canvas.height / 2,
    })
    if (this.ZOOM_IN && this.ZOOM_OUT) {
      // cancel each other out
    } else if (this.ZOOM_IN) {
      this.addEvent([Protocol.INPUT_EV_ZOOM_IN, pos.x, pos.y])
    } else if (this.ZOOM_OUT) {
      this.addEvent([Protocol.INPUT_EV_ZOOM_OUT, pos.x, pos.y])
    }
  }

  _mouseDown(e) {
    if (e.button === 0) {
      const pos = this._viewport.viewportToWorld({
        x: e.offsetX,
        y: e.offsetY,
      })
      this.addEvent([Protocol.INPUT_EV_MOUSE_DOWN, pos.x, pos.y])
    }
  }

  _mouseUp(e) {
    if (e.button === 0) {
      const pos = this._viewport.viewportToWorld({
        x: e.offsetX,
        y: e.offsetY,
      })
      this.addEvent([Protocol.INPUT_EV_MOUSE_UP, pos.x, pos.y])
    }
  }

  _mouseMove(e) {
    const pos = this._viewport.viewportToWorld({
      x: e.offsetX,
      y: e.offsetY,
    })
    this.addEvent([Protocol.INPUT_EV_MOUSE_MOVE, pos.x, pos.y])
  }

  _wheel(e) {
    const pos = this._viewport.viewportToWorld({
      x: e.offsetX,
      y: e.offsetY,
    })
    const evt = e.deltaY < 0 ? Protocol.INPUT_EV_ZOOM_IN : Protocol.INPUT_EV_ZOOM_OUT
    this.addEvent([evt, pos.x, pos.y])
  }
}

async function main() {
  let gameId = GAME_ID
  let CLIENT_ID = initme()

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
  const canvas = addCanvasToDom(Graphics.createCanvas())


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

  if (MODE === MODE_PLAY) {
    const game = await Communication.connect(gameId, CLIENT_ID)
    const gameObject = Util.decodeGame(game)
    Game.setGame(gameObject.id, gameObject)
  } else if (MODE === MODE_REPLAY) {
    const {game, log} = await Communication.connectReplay(gameId, CLIENT_ID)
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

  const bitmaps = await PuzzleGraphics.loadPuzzleBitmaps(Game.getPuzzle(gameId))

  const {
    bgColorPickerEl,
    playerColorPickerEl,
    nameChangeEl,
    updateScoreBoard,
    updateTimer,
    udateTilesDone,
    togglePreview,
    replayControl,
  } = addMenuToDom(Game.getImageUrl(gameId))

  const ts = TIME()
  updateTimer(Game.getStartTs(gameId), Game.getFinishTs(gameId), ts)
  udateTilesDone(Game.getFinishedTileCount(gameId), Game.getTileCount(gameId))
  updateScoreBoard(Game.getRelevantPlayers(gameId, ts), ts)

  const longFinished = !! Game.getFinishTs(gameId)
  let finished = longFinished
  const justFinished = () => finished && !longFinished

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

  const playerBgColor = () => {
    return (Game.getPlayerBgColor(gameId, CLIENT_ID)
        || localStorage.getItem('bg_color')
        || '#222222')
  }
  const playerColor = () => {
    return (Game.getPlayerColor(gameId, CLIENT_ID)
        || localStorage.getItem('player_color')
        || '#ffffff')
  }
  const playerName = () => {
    return (Game.getPlayerName(gameId, CLIENT_ID)
        || localStorage.getItem('player_name')
        || 'anon')
  }

  window.addEventListener('keypress', (ev) => {
    if (KEY_LISTENER_OFF) {
      return
    }
    if (ev.key === ' ') {
      togglePreview()
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

  const evts = new EventAdapter(canvas, window, viewport)

  if (MODE === MODE_PLAY) {
    bgColorPickerEl.value = playerBgColor()
    evts.addEvent([Protocol.INPUT_EV_BG_COLOR, bgColorPickerEl.value])
    bgColorPickerEl.addEventListener('change', () => {
      localStorage.setItem('bg_color', bgColorPickerEl.value)
      evts.addEvent([Protocol.INPUT_EV_BG_COLOR, bgColorPickerEl.value])
    })
    playerColorPickerEl.value = playerColor()
    evts.addEvent([Protocol.INPUT_EV_PLAYER_COLOR, playerColorPickerEl.value])
    playerColorPickerEl.addEventListener('change', () => {
      localStorage.setItem('player_color', playerColorPickerEl.value)
      evts.addEvent([Protocol.INPUT_EV_PLAYER_COLOR, playerColorPickerEl.value])
    })
    nameChangeEl.value = playerName()
    evts.addEvent([Protocol.INPUT_EV_PLAYER_NAME, nameChangeEl.value])
    nameChangeEl.addEventListener('change', () => {
      localStorage.setItem('player_name', nameChangeEl.value)
      evts.addEvent([Protocol.INPUT_EV_PLAYER_NAME, nameChangeEl.value])
    })
    setInterval(() => {
      updateTimer(
        Game.getStartTs(gameId),
        Game.getFinishTs(gameId),
        TIME()
      )
    }, 1000)
  } else if (MODE === MODE_REPLAY) {
    const setSpeedStatus = () => {
      replayControl.speed.innerText = 'Replay-Speed: ' +
        (REPLAY.speeds[REPLAY.speedIdx] + 'x') +
        (REPLAY.paused ? ' Paused' : '')
    }
    setSpeedStatus()
    replayControl.speedUp.addEventListener('click', () => {
      if (REPLAY.speedIdx + 1 < REPLAY.speeds.length) {
        REPLAY.speedIdx++
        setSpeedStatus()
      }
    })
    replayControl.speedDown.addEventListener('click', () => {
      if (REPLAY.speedIdx >= 1) {
        REPLAY.speedIdx--
        setSpeedStatus()
      }
    })
    replayControl.pause.addEventListener('click', () => {
      REPLAY.paused = !REPLAY.paused
      setSpeedStatus()
    })
  }

  if (MODE === MODE_PLAY) {
    Communication.onServerChange((msg) => {
      const msgType = msg[0]
      const evClientId = msg[1]
      const evClientSeq = msg[2]
      const evChanges = msg[3]
      for(let [changeType, changeData] of evChanges) {
        switch (changeType) {
          case Protocol.CHANGE_PLAYER: {
            const p = Util.decodePlayer(changeData)
            if (p.id !== CLIENT_ID) {
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
      updateTimer(
        Game.getStartTs(gameId),
        Game.getFinishTs(gameId),
        TIME()
      )
    }, 50)
  }

  let _last_mouse_down = null
  const onUpdate = () => {
    // handle key downs once per onUpdate
    // this will create Protocol.INPUT_EV_MOVE events if something
    // relevant is pressed
    evts._keydowns()

    for (let evt of evts.consumeAll()) {
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
          if (_last_mouse_down && !Game.getFirstOwnedTile(gameId, CLIENT_ID)) {
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
          if (viewport.zoomIn(viewport.worldToViewport(pos))) {
            RERENDER = true
            Game.changePlayer(gameId, CLIENT_ID, pos)
          }
        } else if (type === Protocol.INPUT_EV_ZOOM_OUT) {
          const pos = { x: evt[1], y: evt[2] }
          if (viewport.zoomOut(viewport.worldToViewport(pos))) {
            RERENDER = true
            Game.changePlayer(gameId, CLIENT_ID, pos)
          }
        }

        // LOCAL + SERVER CHANGES
        // -------------------------------------------------------------
        const ts = TIME()
        const changes = Game.handleInput(GAME_ID, CLIENT_ID, evt, ts)
        if (changes.length > 0) {
          RERENDER = true
        }
        Communication.sendClientEvent(evt)
      } else if (MODE === MODE_REPLAY) {
        // LOCAL ONLY CHANGES
        // -------------------------------------------------------------
        const type = evt[0]
        if (type === Protocol.INPUT_EV_MOUSE_MOVE) {
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
          if (viewport.zoomIn(viewport.worldToViewport(pos))) {
            RERENDER = true
          }
        } else if (type === Protocol.INPUT_EV_ZOOM_OUT) {
          const pos = { x: evt[1], y: evt[2] }
          if (viewport.zoomOut(viewport.worldToViewport(pos))) {
            RERENDER = true
          }
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

    let pos
    let dim

    if (DEBUG) Debug.checkpoint_start(0)

    // CLEAR CTX
    // ---------------------------------------------------------------
    ctx.fillStyle = playerBgColor()
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    if (DEBUG) Debug.checkpoint('clear done')
    // ---------------------------------------------------------------


    // DRAW BOARD
    // ---------------------------------------------------------------
    pos = viewport.worldToViewportRaw({
      x: (TABLE_WIDTH - PUZZLE_WIDTH) / 2,
      y: (TABLE_HEIGHT - PUZZLE_HEIGHT) / 2
    })
    dim = viewport.worldDimToViewportRaw({
      w: PUZZLE_WIDTH,
      h: PUZZLE_HEIGHT,
    })
    ctx.fillStyle = 'rgba(255, 255, 255, .3)'
    ctx.fillRect(pos.x, pos.y, dim.w, dim.h)
    if (DEBUG) Debug.checkpoint('board done')
    // ---------------------------------------------------------------


    // DRAW TILES
    // ---------------------------------------------------------------
    const tiles = Game.getTilesSortedByZIndex(gameId)
    if (DEBUG) Debug.checkpoint('get tiles done')

    for (let tile of tiles) {
      if (tile.owner === -1) {
        if (!PIECE_VIEW_FIXED) {
          continue;
        }
      } else {
        if (!PIECE_VIEW_LOOSE) {
          continue;
        }
      }
      const bmp = bitmaps[tile.idx]
      pos = viewport.worldToViewportRaw({
        x: TILE_DRAW_OFFSET + tile.pos.x,
        y: TILE_DRAW_OFFSET + tile.pos.y,
      })
      dim = viewport.worldDimToViewportRaw({
        w: TILE_DRAW_SIZE,
        h: TILE_DRAW_SIZE,
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
    const ts = TIME()
    const texts = []
    // Cursors
    for (let player of Game.getActivePlayers(gameId, ts)) {
      const cursor = await getPlayerCursor(player)
      const pos = viewport.worldToViewport(player)
      ctx.drawImage(cursor, pos.x - CURSOR_W_2, pos.y - CURSOR_H_2)
      if (
        (MODE === MODE_PLAY && player.id !== CLIENT_ID)
        || (MODE === MODE_REPLAY)
      ) {
        // performance:
        // not drawing text directly here, to have less ctx
        // switches between drawImage and fillTxt
        texts.push([
          `${player.name} (${player.points})`,
          pos.x,
          pos.y + CURSOR_H,
        ])
      }
    }

    // Names
    ctx.fillStyle = 'white'
    ctx.textAlign = 'center'
    for (let [txt, x, y] of texts) {
      ctx.fillText(txt, x, y)
    }

    if (DEBUG) Debug.checkpoint('players done')

    // DRAW PLAYERS
    // ---------------------------------------------------------------
    updateScoreBoard(Game.getRelevantPlayers(gameId, ts), ts)
    udateTilesDone(Game.getFinishedTileCount(gameId), Game.getTileCount(gameId))
    if (DEBUG) Debug.checkpoint('scores done')
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
}

main()
