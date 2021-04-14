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

function addMenuToDom(gameId) {
  const previewImageUrl = Game.getImageUrl(gameId)
  function row (...elements) {
    const row = document.createElement('tr')
    for (let el of elements) {
      const td = document.createElement('td')
      td.appendChild(el)
      row.appendChild(td)
    }
    return row
  }

  function btn(txt) {
    const btn = document.createElement('button')
    btn.classList.add('btn')
    btn.innerText = txt
    return btn
  }

  function colorinput() {
    const input = document.createElement('input')
    input.type = 'color'
    return input
  }

  function textinput(maxLength) {
    const input = document.createElement('input')
    input.type = 'text'
    input.maxLength = maxLength
    return input
  }

  function label(text) {
    const label = document.createElement('label')
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

  const settingsEl = document.createElement('table')
  settingsEl.classList.add('settings')
  settingsEl.appendChild(bgColorPickerRow)
  settingsEl.appendChild(playerColorPickerRow)
  settingsEl.appendChild(nameChangeRow)
  settingsEl.addEventListener('click', (e) => {
    e.stopPropagation()
  })

  const settingsOverlay = document.createElement('div')
  settingsOverlay.classList.add('overlay', 'transparent', 'closed')
  settingsOverlay.appendChild(settingsEl)
  settingsOverlay.addEventListener('click', () => {
    settingsOverlay.classList.toggle('closed')
  })

  const previewEl = document.createElement('div')
  previewEl.classList.add('preview')

  const imgEl = document.createElement('div')
  imgEl.classList.add('img')
  imgEl.style.backgroundImage = `url(${previewImageUrl})`
  previewEl.appendChild(imgEl)

  const previewOverlay = document.createElement('div')
  previewOverlay.classList.add('overlay', 'closed')
  previewOverlay.appendChild(previewEl)
  previewOverlay.addEventListener('click', () => {
    previewOverlay.classList.toggle('closed')
  })

  const settingsOpenerEl = document.createElement('div')
  settingsOpenerEl.classList.add('opener')
  settingsOpenerEl.appendChild(document.createTextNode('🛠️ Settings'))
  settingsOpenerEl.addEventListener('click', () => {
    settingsOverlay.classList.toggle('closed')
  })

  const homeEl = document.createElement('a')
  homeEl.classList.add('opener')
  homeEl.appendChild(document.createTextNode('🧩 Puzzles'))
  homeEl.href = "/"

  const previewOpenerEl = document.createElement('div')
  previewOpenerEl.classList.add('opener')
  previewOpenerEl.appendChild(document.createTextNode('🖼️ Preview'))
  previewOpenerEl.addEventListener('click', () => {
    previewOverlay.classList.toggle('closed')
  })

  const tabsEl = document.createElement('div')
  tabsEl.classList.add('tabs')
  tabsEl.appendChild(homeEl)
  tabsEl.appendChild(previewOpenerEl)
  tabsEl.appendChild(settingsOpenerEl)

  const menuEl = document.createElement('div')
  menuEl.classList.add('menu')
  menuEl.appendChild(tabsEl)

  const scoresTitleEl = document.createElement('div')
  scoresTitleEl.appendChild(document.createTextNode('Scores'))

  const scoresListEl = document.createElement('table')
  const updateScores = () => {
    const ts = TIME()
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

  const timerCountdownEl = document.createElement('div')
  timerCountdownEl.innerText = timerStr()
  setInterval(() => {
    timerCountdownEl.innerText = timerStr()
  }, 50) // needs to be small, so that it updates quick enough in replay

  const timerEl = document.createElement('div')
  timerEl.classList.add('timer')
  timerEl.appendChild(timerCountdownEl)

  let replayControl = null
  if (MODE === 'replay') {
    const replayControlEl = document.createElement('div')
    const speedUp = btn('⏫')
    const speedDown = btn('⏬')
    const pause = btn('⏸️')
    const speed = document.createElement('div')
    replayControlEl.appendChild(speed)
    replayControlEl.appendChild(speedUp)
    replayControlEl.appendChild(speedDown)
    replayControlEl.appendChild(pause)
    timerEl.appendChild(replayControlEl)
    replayControl = { speedUp, speedDown, pause, speed }
  }

  const scoresEl = document.createElement('div')
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
    updateScores,
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

  const cursors = {}
  const getPlayerCursor = async (p) => {
    let key = p.color + ' ' + p.d
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
  let GAME_LOG
  let GAME_LOG_IDX = 0
  let REPLAY_SPEEDS = [0.5, 1, 2, 5, 10, 20, 50]
  let REPLAY_SPEED_IDX = 1
  let REPLAY_PAUSED = false
  let lastRealTime = null
  let lastGameTime = null
  let GAME_START_TS = null

  if (MODE === 'play') {
    const game = await Communication.connect(gameId, CLIENT_ID)
    Game.newGame(Util.decodeGame(game))
  } else if (MODE === 'replay') {
    const {game, log} = await Communication.connectReplay(gameId, CLIENT_ID)
    Game.newGame(Util.decodeGame(game))
    GAME_LOG = log
    lastRealTime = Time.timestamp()
    GAME_START_TS = GAME_LOG[0][GAME_LOG[0].length - 1]
    lastGameTime = GAME_START_TS
    TIME = () => lastGameTime
  } else {
    throw '[ 2020-12-22 MODE invalid, must be play|replay ]'
  }

  const bitmaps = await PuzzleGraphics.loadPuzzleBitmaps(Game.getPuzzle(gameId))

  const {bgColorPickerEl, playerColorPickerEl, nameChangeEl, updateScores, replayControl} = addMenuToDom(gameId)
  updateScores()

  const longFinished = Game.getFinishTs(gameId)
  let finished = longFinished ? true : false
  const justFinished = () => !!(finished && !longFinished)

  const fireworks = new fireworksController(canvas, Game.getRng(gameId))
  fireworks.init(canvas)

  const ctx = canvas.getContext('2d')
  canvas.classList.add('loaded')

  // initialize some view data
  // this global data will change according to input events
  const viewport = new Camera(canvas)
  // center viewport
  viewport.move(
    -(Game.getTableWidth(gameId) - viewport.width) /2,
    -(Game.getTableHeight(gameId) - viewport.height) /2
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
  if (MODE === 'play') {
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
  } else if (MODE === 'replay') {
    const setSpeedStatus = () => {
      replayControl.speed.innerText = 'Replay-Speed: ' + (REPLAY_SPEEDS[REPLAY_SPEED_IDX] + 'x') + (REPLAY_PAUSED ? ' Paused' : '')
    }
    setSpeedStatus()
    replayControl.speedUp.addEventListener('click', () => {
      if (REPLAY_SPEED_IDX + 1 < REPLAY_SPEEDS.length) {
        REPLAY_SPEED_IDX++
        setSpeedStatus()
      }
    })
    replayControl.speedDown.addEventListener('click', () => {
      if (REPLAY_SPEED_IDX >= 1) {
        REPLAY_SPEED_IDX--
        setSpeedStatus()
      }
    })
    replayControl.pause.addEventListener('click', () => {
      REPLAY_PAUSED = !REPLAY_PAUSED
      setSpeedStatus()
    })
  }

  if (MODE === 'play') {
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
      finished = Game.getFinishTs(gameId)
    })
  } else if (MODE === 'replay') {
    // no external communication for replay mode,
    // only the GAME_LOG is relevant
    let inter = setInterval(() => {
      let realTime = Time.timestamp()
      if (REPLAY_PAUSED) {
        lastRealTime = realTime
        return
      }
      let timePassedReal = realTime - lastRealTime

      let timePassedGame = timePassedReal * REPLAY_SPEEDS[REPLAY_SPEED_IDX]
      let maxGameTs = lastGameTime + timePassedGame
      do {
        if (REPLAY_PAUSED) {
          break
        }
        let nextIdx = GAME_LOG_IDX + 1
        if (nextIdx >= GAME_LOG.length) {
          clearInterval(inter)
          break
        }

        let logEntry = GAME_LOG[nextIdx]
        let nextTs = GAME_START_TS + logEntry[logEntry.length - 1]
        if (nextTs > maxGameTs) {
          break
        }

        let entryWithTs = logEntry.slice()
        entryWithTs[entryWithTs.length - 1] = nextTs
        if (entryWithTs[0] === Protocol.LOG_ADD_PLAYER) {
          Game.addPlayer(gameId, ...entryWithTs.slice(1))
          RERENDER = true
        } else if (entryWithTs[0] === Protocol.LOG_UPDATE_PLAYER) {
          let playerId = Game.getPlayerIdByIndex(gameId, entryWithTs[1])
          Game.addPlayer(gameId, playerId, ...entryWithTs.slice(2))
          RERENDER = true
        } else if (entryWithTs[0] === Protocol.LOG_HANDLE_INPUT) {
          let playerId = Game.getPlayerIdByIndex(gameId, entryWithTs[1])
          Game.handleInput(gameId, playerId, ...entryWithTs.slice(2))
          RERENDER = true
        }
        GAME_LOG_IDX = nextIdx
      } while (true)
      lastRealTime = realTime
      lastGameTime = maxGameTs
    }, 50)
  }

  let _last_mouse_down = null
  const onUpdate = () => {
    for (let evt of evts.consumeAll()) {
      if (MODE === 'play') {
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
          if (viewport.zoomIn()) {
            const pos = { x: evt[1], y: evt[2] }
            RERENDER = true
            Game.changePlayer(gameId, CLIENT_ID, pos)
          }
        } else if (type === Protocol.INPUT_EV_ZOOM_OUT) {
          if (viewport.zoomOut()) {
            const pos = { x: evt[1], y: evt[2] }
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
      } else if (MODE === 'replay') {
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
          viewport.zoomIn()
          RERENDER = true
        } else if (type === Protocol.INPUT_EV_ZOOM_OUT) {
          viewport.zoomOut()
          RERENDER = true
        }
      }
    }

    finished = Game.getFinishTs(gameId)
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
      x: (Game.getTableWidth(gameId) - Game.getPuzzleWidth(gameId)) / 2,
      y: (Game.getTableHeight(gameId) - Game.getPuzzleHeight(gameId)) / 2
    })
    dim = viewport.worldDimToViewportRaw({
      w: Game.getPuzzleWidth(gameId),
      h: Game.getPuzzleHeight(gameId),
    })
    ctx.fillStyle = 'rgba(255, 255, 255, .3)'
    ctx.fillRect(pos.x, pos.y, dim.w, dim.h)
    if (DEBUG) Debug.checkpoint('board done')
    // ---------------------------------------------------------------


    // DRAW TILES
    // ---------------------------------------------------------------
    for (let tile of Game.getTilesSortedByZIndex(gameId)) {
      const bmp = bitmaps[tile.idx]
      pos = viewport.worldToViewportRaw({
        x: Game.getTileDrawOffset(gameId) + tile.pos.x,
        y: Game.getTileDrawOffset(gameId) + tile.pos.y,
      })
      dim = viewport.worldDimToViewportRaw({
        w: Game.getTileDrawSize(gameId),
        h: Game.getTileDrawSize(gameId),
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
    for (let player of Game.getActivePlayers(gameId, ts)) {
      const cursor = await getPlayerCursor(player)
      const pos = viewport.worldToViewportRaw(player)
      ctx.drawImage(cursor,
        Math.round(pos.x - cursor.width/2),
        Math.round(pos.y - cursor.height/2)
      )
      if (MODE === 'play') {
        if (player.id !== CLIENT_ID) {
          ctx.fillStyle = 'white'
          ctx.font = '10px sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText(player.name + ' (' + player.points + ')',
            Math.round(pos.x),
            Math.round(pos.y) + cursor.height
          )
        }
      } else if (MODE === 'replay') {
        ctx.fillStyle = 'white'
        ctx.font = '10px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(player.name + ' (' + player.points + ')',
          Math.round(pos.x),
          Math.round(pos.y) + cursor.height
        )
      }
    }
    if (DEBUG) Debug.checkpoint('players done')

    // DRAW PLAYERS
    // ---------------------------------------------------------------
    updateScores()
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
