"use strict"
import {run} from './gameloop.js'
import Camera from './Camera.js'
import Graphics from './Graphics.js'
import Debug from './Debug.js'
import Communication from './Communication.js'
import Util from './../common/Util.js'
import PuzzleGraphics from './PuzzleGraphics.js'
import Game from './Game.js'
import fireworksController from './Fireworks.js'
import Protocol from '../common/Protocol.js'
import Time from '../common/Time.js'

if (typeof GAME_ID === 'undefined') throw '[ GAME_ID not set ]'
if (typeof WS_ADDRESS === 'undefined') throw '[ WS_ADDRESS not set ]'
if (typeof MODE === 'undefined') throw '[ MODE not set ]'

if (typeof DEBUG === 'undefined') window.DEBUG = false

const MODE_PLAY = 'play'
const MODE_REPLAY = 'replay'

let RERENDER = true

let TIME = () => Time.timestamp()

function addCanvasToDom(canvas) {
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  document.body.appendChild(canvas)
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

function addMenuToDom(gameId) {
  const previewImageUrl = Game.getImageUrl(gameId)
  function row (...elements) {
    const row = ELEMENTS.TR.cloneNode(true)
    for (let el of elements) {
      const td = ELEMENTS.TD.cloneNode(true)
      td.appendChild(el)
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
  const bgColorPickerRow = row(
    label('Background: '),
    bgColorPickerEl
  )

  const playerColorPickerEl = colorinput()
  const playerColorPickerRow = row(
    label('Color: '),
    playerColorPickerEl
  )

  const nameChangeEl = textinput(16)
  const nameChangeRow = row(
    label('Name: '),
    nameChangeEl
  )

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
    settingsOverlay.classList.toggle('closed')
  })

  const previewEl = ELEMENTS.DIV.cloneNode(true)
  previewEl.classList.add('preview')

  const imgEl = ELEMENTS.DIV.cloneNode(true)
  imgEl.classList.add('img')
  imgEl.style.backgroundImage = `url(${previewImageUrl})`
  previewEl.appendChild(imgEl)

  const previewOverlay = ELEMENTS.DIV.cloneNode(true)
  previewOverlay.classList.add('overlay', 'closed')
  previewOverlay.appendChild(previewEl)
  previewOverlay.addEventListener('click', () => {
    previewOverlay.classList.toggle('closed')
  })

  const settingsOpenerEl = ELEMENTS.DIV.cloneNode(true)
  settingsOpenerEl.classList.add('opener')
  settingsOpenerEl.appendChild(document.createTextNode('🛠️ Settings'))
  settingsOpenerEl.addEventListener('click', () => {
    settingsOverlay.classList.toggle('closed')
  })

  const homeEl = ELEMENTS.A.cloneNode(true)
  homeEl.classList.add('opener')
  homeEl.appendChild(document.createTextNode('🧩 Puzzles'))
  homeEl.target = '_blank'
  homeEl.href = '/'

  const previewOpenerEl = ELEMENTS.DIV.cloneNode(true)
  previewOpenerEl.classList.add('opener')
  previewOpenerEl.appendChild(document.createTextNode('🖼️ Preview'))
  previewOpenerEl.addEventListener('click', () => {
    previewOverlay.classList.toggle('closed')
  })

  const tabsEl = ELEMENTS.DIV.cloneNode(true)
  tabsEl.classList.add('tabs')
  tabsEl.appendChild(homeEl)
  tabsEl.appendChild(previewOpenerEl)
  tabsEl.appendChild(settingsOpenerEl)

  const menuEl = ELEMENTS.DIV.cloneNode(true)
  menuEl.classList.add('menu')
  menuEl.appendChild(tabsEl)

  const scoresTitleEl = ELEMENTS.DIV.cloneNode(true)
  scoresTitleEl.appendChild(document.createTextNode('Scores'))

  const scoresListEl = ELEMENTS.TABLE.cloneNode(true)
  const updateScoreBoard = (ts) => {
    const minTs = ts - 30 * Time.SEC

    const players = Game.getRelevantPlayers(gameId, ts)
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

  const timerStr = () => {
    const started = Game.getStartTs(gameId)
    const ended = Game.getFinishTs(gameId)
    const icon = ended ? '🏁' : '⏳'
    const from = started;
    const to = ended || TIME()
    const timeDiffStr = Time.timeDiffStr(from, to)
    return `${icon} ${timeDiffStr}`
  }

  const timerCountdownEl = ELEMENTS.DIV.cloneNode(true)
  const updateTimer = () => {
    timerCountdownEl.innerText = timerStr()
  }

  const timerEl = ELEMENTS.DIV.cloneNode(true)
  timerEl.classList.add('timer')
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

  document.body.appendChild(settingsOverlay)
  document.body.appendChild(previewOverlay)
  document.body.appendChild(timerEl)
  document.body.appendChild(menuEl)
  document.body.appendChild(scoresEl)

  return {
    bgColorPickerEl,
    playerColorPickerEl,
    nameChangeEl,
    updateScoreBoard,
    updateTimer,
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

export default class EventAdapter {
  constructor(canvas, viewport) {
    this.events = []
    this._viewport = viewport
    canvas.addEventListener('mousedown', this._mouseDown.bind(this))
    canvas.addEventListener('mouseup', this._mouseUp.bind(this))
    canvas.addEventListener('mousemove', this._mouseMove.bind(this))
    canvas.addEventListener('wheel', this._wheel.bind(this))
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
    Game.newGame(Util.decodeGame(game))
  } else if (MODE === MODE_REPLAY) {
    const {game, log} = await Communication.connectReplay(gameId, CLIENT_ID)
    Game.newGame(Util.decodeGame(game))
    REPLAY.log = log
    REPLAY.lastRealTs = Time.timestamp()
    REPLAY.gameStartTs = REPLAY.log[0][REPLAY.log[0].length - 1]
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

  const {bgColorPickerEl, playerColorPickerEl, nameChangeEl, updateScoreBoard, updateTimer, replayControl} = addMenuToDom(gameId)
  updateTimer()
  updateScoreBoard(TIME())

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

  const evts = new EventAdapter(canvas, viewport)
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
    setInterval(updateTimer, 1000)
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
          case 'player': {
            const p = Util.decodePlayer(changeData)
            if (p.id !== CLIENT_ID) {
              Game.setPlayer(gameId, p.id, p)
              RERENDER = true
            }
          } break;
          case 'tile': {
            const t = Util.decodeTile(changeData)
            Game.setTile(gameId, t.idx, t)
            RERENDER = true
          } break;
          case 'data': {
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
      updateTimer()
    }, 50)
  }

  let _last_mouse_down = null
  const onUpdate = () => {
    for (let evt of evts.consumeAll()) {
      if (MODE === MODE_PLAY) {
        // LOCAL ONLY CHANGES
        // -------------------------------------------------------------
        const type = evt[0]
        if (type === Protocol.INPUT_EV_MOUSE_MOVE) {
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
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'center'
    for (let [txt, x, y] of texts) {
      ctx.fillText(txt, x, y)
    }

    if (DEBUG) Debug.checkpoint('players done')

    // DRAW PLAYERS
    // ---------------------------------------------------------------
    updateScoreBoard(ts)
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
