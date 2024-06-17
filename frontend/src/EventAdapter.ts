import { GAME_EVENT_TYPE } from '../../common/src/Protocol'
import { GameEvent } from '../../common/src/Types'
import { Camera, Snapshot } from '../../common/src/Camera'
import { Game } from './Game'
import { MODE_REPLAY } from './GameMode'

export class EventAdapter {
  private events: Array<GameEvent> = []

  private KEYS_ON = true

  private LEFT = false
  private RIGHT = false
  private UP = false
  private DOWN = false
  private ZOOM_IN = false
  private ZOOM_OUT = false
  private SHIFT = false

  private mouseDown: boolean = false
  private lastMouseRaw: [number, number]|null = null
  private lastMouseWorld: [number, number]|null = null

  private onResize
  private onMouseDown
  private onMouseUp
  private onMouseMove
  private onMouseEnter
  private onWheel
  private onKeyUp
  private onKeyDown
  private onKeyPress
  private onWndMouseDown

  constructor (private game: Game<any>) {
    this.onResize = this.game.initViewport.bind(this.game)
    this.onMouseDown = this._onMouseDown.bind(this)
    this.onMouseUp = this._onMouseUp.bind(this)
    this.onMouseMove = this._onMouseMove.bind(this)
    this.onWheel = this._onWheel.bind(this)
    this.onKeyUp = this._onKeyUp.bind(this)
    this.onKeyDown = this._onKeyDown.bind(this)
    this.onKeyPress = this._onKeyPress.bind(this)
    this.onWndMouseDown = this._onWndMouseDown.bind(this)
    this.onMouseEnter = this._onMouseEnter.bind(this)
  }

  _toWorldPoint (x: number, y: number): [number, number] {
    const pos = this.game.getViewport().viewportToWorld({x, y})
    return [pos.x, pos.y]
  }

  _toWorldDim (w: number, h: number): [number, number] {
    const dim = this.game.getViewport().viewportDimToWorld({ w, h })
    return [ dim.w, dim.h ]
  }

  _mousePos (ev: MouseEvent) {
    return this._toWorldPoint(ev.offsetX, ev.offsetY)
  }

  _canvasCenter () {
    const c = this.game.getCanvas()
    return this._toWorldPoint(c.width / 2, c.height / 2)
  }

  _key (state: boolean, ev: KeyboardEvent) {
    if (!this.KEYS_ON) {
      return
    }

    if (ev.code === 'ShiftLeft' || ev.code === 'ShiftRight') {
      this.SHIFT = state
    } else if (ev.code === 'ArrowUp' || ev.code === 'KeyW') {
      this.UP = state
    } else if (ev.code === 'ArrowDown' || ev.code === 'KeyS') {
      this.DOWN = state
    } else if (ev.code === 'ArrowLeft' || ev.code === 'KeyA') {
      this.LEFT = state
    } else if (ev.code === 'ArrowRight' || ev.code === 'KeyD') {
      this.RIGHT = state
    } else if (ev.code === 'KeyQ') {
      this.ZOOM_OUT = state
    } else if (ev.code === 'KeyE') {
      this.ZOOM_IN = state
    }
  }

  _onMouseDown (ev: MouseEvent) {
    this.lastMouseWorld = this._mousePos(ev)
    this.lastMouseRaw = [ev.offsetX, ev.offsetY]
    if (ev.button === 0) {
      this.mouseDown = true
      this.addEvent([GAME_EVENT_TYPE.INPUT_EV_MOUSE_DOWN, ...this.lastMouseWorld])
    }
  }

  _onMouseUp (ev: MouseEvent) {
    this.lastMouseWorld = this._mousePos(ev)
    this.lastMouseRaw = [ev.offsetX, ev.offsetY]
    if (ev.button === 0) {
      this.mouseDown = false
      this.addEvent([GAME_EVENT_TYPE.INPUT_EV_MOUSE_UP, ...this.lastMouseWorld])
    }
  }

  _onMouseMove (ev: MouseEvent) {
    if (!this.lastMouseRaw) {
      return
    }
    this.lastMouseWorld = this._mousePos(ev)
    const diffWorld = this._toWorldDim(
      -(this.lastMouseRaw[0] - ev.offsetX),
      -(this.lastMouseRaw[1] - ev.offsetY),
    )
    this.addEvent([GAME_EVENT_TYPE.INPUT_EV_MOUSE_MOVE, ...this.lastMouseWorld, ...diffWorld, this.mouseDown ? 1 : 0])
    this.lastMouseRaw = [ev.offsetX, ev.offsetY]
  }

  _onWheel (ev: WheelEvent) {
    this.lastMouseWorld = this._mousePos(ev)
    if (this.game.getViewport().canZoom(ev.deltaY < 0 ? 'in' : 'out')) {
      const evt = ev.deltaY < 0
        ? GAME_EVENT_TYPE.INPUT_EV_ZOOM_IN
        : GAME_EVENT_TYPE.INPUT_EV_ZOOM_OUT
      this.addEvent([evt, ...this.lastMouseWorld])
    }
  }

  _onKeyUp (ev: KeyboardEvent) {
    this._key(true, ev)
  }

  _onKeyDown (ev: KeyboardEvent) {
    this._key(false, ev)
  }

  _onKeyPress (ev: KeyboardEvent) {
    if (!this.KEYS_ON) {
      return
    }

    if (this.game.getMode() === MODE_REPLAY) {
      if (ev.code === 'KeyI') {
        this.addEvent([GAME_EVENT_TYPE.INPUT_EV_REPLAY_SPEED_UP])
      } else if (ev.code === 'KeyO') {
        this.addEvent([GAME_EVENT_TYPE.INPUT_EV_REPLAY_SPEED_DOWN])
      } else if (ev.code === 'KeyP') {
        this.addEvent([GAME_EVENT_TYPE.INPUT_EV_REPLAY_TOGGLE_PAUSE])
      }
    }

    if (ev.code === 'KeyH') {
      this.addEvent([GAME_EVENT_TYPE.INPUT_EV_TOGGLE_INTERFACE])
    } else if (ev.code === 'Space') {
      this.addEvent([GAME_EVENT_TYPE.INPUT_EV_TOGGLE_PREVIEW])
    } else if (ev.code === 'KeyF') {
      this.addEvent([GAME_EVENT_TYPE.INPUT_EV_TOGGLE_FIXED_PIECES])
    } else if (ev.code === 'KeyG') {
      this.addEvent([GAME_EVENT_TYPE.INPUT_EV_TOGGLE_LOOSE_PIECES])
    } else if (ev.code === 'KeyM') {
      this.addEvent([GAME_EVENT_TYPE.INPUT_EV_TOGGLE_SOUNDS])
    } else if (ev.code === 'KeyN') {
      this.addEvent([GAME_EVENT_TYPE.INPUT_EV_TOGGLE_PLAYER_NAMES])
    } else if (ev.code === 'KeyT') {
      this.addEvent([GAME_EVENT_TYPE.INPUT_EV_TOGGLE_TABLE])
    } else if (ev.code === 'KeyC') {
      this.addEvent([GAME_EVENT_TYPE.INPUT_EV_CENTER_FIT_PUZZLE])
    } else {
      for (let i = 0; i <= 9; i++) {
        if (ev.code === `Digit${i}`) {
          // store or restore pos+zoom in slot i
          const evt = ev.shiftKey ? GAME_EVENT_TYPE.INPUT_EV_STORE_POS : GAME_EVENT_TYPE.INPUT_EV_RESTORE_POS
          this.addEvent([evt, i])
          break
        }
      }
    }
  }

  // Prevents selecting text outside of canvas when double clicking the canvas
  _onWndMouseDown (ev: MouseEvent): void {
    if (ev.target === this.game.getCanvas() && ev.detail > 1) {
      ev.preventDefault()
    }
  }

  _onMouseEnter (ev: MouseEvent): void {
    if (!this.mouseDown) {
      return
    }

    if (ev.buttons === 1) {
      // still holding mouse down (or released outside of game)
      return
    }

    this.lastMouseWorld = this._mousePos(ev)
    this.lastMouseRaw = [ev.offsetX, ev.offsetY]
    this.mouseDown = false
    this.addEvent([GAME_EVENT_TYPE.INPUT_EV_MOUSE_UP, ...this.lastMouseWorld])
  }

  registerEvents () {
    const w = this.game.getWindow()
    w.addEventListener('resize', this.onResize)
    w.addEventListener('keydown', this.onKeyUp)
    w.addEventListener('keyup', this.onKeyDown)
    w.addEventListener('keypress', this.onKeyPress)
    w.addEventListener('mousedown', this.onWndMouseDown)

    const c = this.game.getCanvas()
    c.addEventListener('mousedown', this.onMouseDown)
    c.addEventListener('mouseup', this.onMouseUp)
    c.addEventListener('mousemove', this.onMouseMove)
    c.addEventListener('mouseenter', this.onMouseEnter)
    c.addEventListener('wheel', this.onWheel)
  }

  unregisterEvents () {
    const w = this.game.getWindow()
    w.removeEventListener('resize', this.onResize)
    w.removeEventListener('keydown', this.onKeyUp)
    w.removeEventListener('keyup', this.onKeyDown)
    w.removeEventListener('keypress', this.onKeyPress)
    w.removeEventListener('mousedown', this.onWndMouseDown)

    const c = this.game.getCanvas()
    c.removeEventListener('mousedown', this.onMouseDown)
    c.removeEventListener('mouseup', this.onMouseUp)
    c.removeEventListener('mousemove', this.onMouseMove)
    c.removeEventListener('wheel', this.onWheel)
  }

  createSnapshotEvents (prev: Snapshot, curr: Snapshot) {
    if (!this.lastMouseRaw || !this.lastMouseWorld) {
      return
    }

    const prevWorld = new Camera(prev).viewportToWorld({x: this.lastMouseRaw[0], y: this.lastMouseRaw[1]})
    const currWorld = new Camera(curr).viewportToWorld({x: this.lastMouseRaw[0], y: this.lastMouseRaw[1]})
    const diffWorld = [
      -(prevWorld.x - currWorld.x),
      -(prevWorld.y - currWorld.y),
    ] as const
    this.addEvent([GAME_EVENT_TYPE.INPUT_EV_MOUSE_MOVE, ...this.lastMouseWorld, ...diffWorld, this.mouseDown ? 1 : 0])
  }

  addEvent (event: GameEvent) {
    this.events.push(event)
  }

  consumeAll (): GameEvent[] {
    if (this.events.length === 0) {
      return []
    }
    const all = this.events.slice()
    this.events = []
    return all
  }

  createKeyEvents (): void {
    const w = (this.LEFT ? 1 : 0) - (this.RIGHT ? 1 : 0)
    const h = (this.UP ? 1 : 0) - (this.DOWN ? 1 : 0)
    if (w !== 0 || h !== 0) {
      const amount = (this.SHIFT ? 24 : 12) * Math.sqrt(this.game.getViewport().getCurrentZoom())
      const pos = this.game.getViewport().viewportDimToWorld({w: w * amount, h: h * amount})
      this.addEvent([GAME_EVENT_TYPE.INPUT_EV_MOVE, pos.w, pos.h])
      if (this.lastMouseWorld) {
        this.lastMouseWorld[0] -= pos.w
        this.lastMouseWorld[1] -= pos.h
      }
    }

    if (this.ZOOM_IN && this.ZOOM_OUT) {
      // cancel each other out
    } else if (this.ZOOM_IN) {
      if (this.game.getViewport().canZoom('in')) {
        const target = this.lastMouseWorld || this._canvasCenter()
        this.addEvent([GAME_EVENT_TYPE.INPUT_EV_ZOOM_IN, ...target])
      }
    } else if (this.ZOOM_OUT) {
      if (this.game.getViewport().canZoom('out')) {
        const target = this.lastMouseWorld || this._canvasCenter()
        this.addEvent([GAME_EVENT_TYPE.INPUT_EV_ZOOM_OUT, ...target])
      }
    }
  }

  setHotkeys (state: boolean) {
    this.KEYS_ON = state
  }
}
