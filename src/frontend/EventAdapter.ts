import Protocol from "../common/Protocol"
import { GameEvent } from "../common/Types"
import { Camera, Snapshot } from "./Camera"
import { MODE_REPLAY } from "./game"

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

  constructor (
    private canvas: HTMLCanvasElement,
    private window: Window,
    private viewport: Camera,
    private MODE: string
  ) {
    // pass
  }

  _toWorldPoint (x: number, y: number): [number, number] {
    const pos = this.viewport.viewportToWorld({x, y})
    return [pos.x, pos.y]
  }

  _toWorldDim (w: number, h: number): [number, number] {
    const dim = this.viewport.viewportDimToWorld({ w, h })
    return [ dim.w, dim.h ]
  }

  _mousePos (ev: MouseEvent) {
    return this._toWorldPoint(ev.offsetX, ev.offsetY)
  }

  _canvasCenter () {
    return this._toWorldPoint(this.canvas.width / 2, this.canvas.height / 2)
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
      this.addEvent([Protocol.INPUT_EV_MOUSE_DOWN, ...this.lastMouseWorld])
    }
  }

  _onMouseUp (ev: MouseEvent) {
    this.lastMouseWorld = this._mousePos(ev)
    this.lastMouseRaw = [ev.offsetX, ev.offsetY]
    if (ev.button === 0) {
      this.mouseDown = false
      this.addEvent([Protocol.INPUT_EV_MOUSE_UP, ...this.lastMouseWorld])
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
    this.addEvent([Protocol.INPUT_EV_MOUSE_MOVE, ...this.lastMouseWorld, ...diffWorld, this.mouseDown ? 1 : 0])
    this.lastMouseRaw = [ev.offsetX, ev.offsetY]
  }

  _onWheel (ev: WheelEvent) {
    this.lastMouseWorld = this._mousePos(ev)
    if (this.viewport.canZoom(ev.deltaY < 0 ? 'in' : 'out')) {
      const evt = ev.deltaY < 0
        ? Protocol.INPUT_EV_ZOOM_IN
        : Protocol.INPUT_EV_ZOOM_OUT
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

    if (this.MODE === MODE_REPLAY) {
      if (ev.code === 'KeyI') {
        this.addEvent([Protocol.INPUT_EV_REPLAY_SPEED_UP])
      } else if (ev.code === 'KeyO') {
        this.addEvent([Protocol.INPUT_EV_REPLAY_SPEED_DOWN])
      } else if (ev.code === 'KeyP') {
        this.addEvent([Protocol.INPUT_EV_REPLAY_TOGGLE_PAUSE])
      }
    }

    if (ev.code === 'KeyH') {
      this.addEvent([Protocol.INPUT_EV_TOGGLE_INTERFACE])
    } else if (ev.code === 'Space') {
      this.addEvent([Protocol.INPUT_EV_TOGGLE_PREVIEW])
    } else if (ev.code === 'KeyF') {
      this.addEvent([Protocol.INPUT_EV_TOGGLE_FIXED_PIECES])
    } else if (ev.code === 'KeyG') {
      this.addEvent([Protocol.INPUT_EV_TOGGLE_LOOSE_PIECES])
    } else if (ev.code === 'KeyM') {
      this.addEvent([Protocol.INPUT_EV_TOGGLE_SOUNDS])
    } else if (ev.code === 'KeyN') {
      this.addEvent([Protocol.INPUT_EV_TOGGLE_PLAYER_NAMES])
    } else if (ev.code === 'KeyT') {
      this.addEvent([Protocol.INPUT_EV_TOGGLE_TABLE])
    } else if (ev.code === 'KeyC') {
      this.addEvent([Protocol.INPUT_EV_CENTER_FIT_PUZZLE])
    } else {
      for (let i = 0; i <= 9; i++) {
        if (ev.code === `Digit${i}`) {
          // store or restore pos+zoom in slot i
          const evt = ev.shiftKey ? Protocol.INPUT_EV_STORE_POS : Protocol.INPUT_EV_RESTORE_POS
          this.addEvent([evt, i])
          break;
        }
      }
    }
  }

  // Prevents selecting text outside of canvas when double clicking the canvas
  _onWndMouseDown (ev: MouseEvent): void {
    if (ev.target === this.canvas && ev.detail > 1) {
      ev.preventDefault()
    }
  }

  registerEvents () {
    this.canvas.addEventListener('mousedown', this._onMouseDown.bind(this))
    this.canvas.addEventListener('mouseup', this._onMouseUp.bind(this))
    this.canvas.addEventListener('mousemove', this._onMouseMove.bind(this))
    this.canvas.addEventListener('wheel', this._onWheel.bind(this))
    this.window.addEventListener('keydown', this._onKeyUp.bind(this))
    this.window.addEventListener('keyup', this._onKeyDown.bind(this))
    this.window.addEventListener('keypress', this._onKeyPress.bind(this))
    this.window.addEventListener('mousedown', this._onWndMouseDown.bind(this))
  }
  unregisterEvents () {
    this.canvas.removeEventListener('mousedown', this._onMouseDown.bind(this))
    this.canvas.removeEventListener('mouseup', this._onMouseUp.bind(this))
    this.canvas.removeEventListener('mousemove', this._onMouseMove.bind(this))
    this.canvas.removeEventListener('wheel', this._onWheel.bind(this))
    this.window.removeEventListener('keydown', this._onKeyUp.bind(this))
    this.window.removeEventListener('keyup', this._onKeyDown.bind(this))
    this.window.removeEventListener('keypress', this._onKeyPress.bind(this))
    this.window.removeEventListener('mousedown', this._onWndMouseDown.bind(this))
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
    ]
    this.addEvent([Protocol.INPUT_EV_MOUSE_MOVE, ...this.lastMouseWorld, ...diffWorld, this.mouseDown ? 1 : 0])
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
      const amount = (this.SHIFT ? 24 : 12) * Math.sqrt(this.viewport.getCurrentZoom())
      const pos = this.viewport.viewportDimToWorld({w: w * amount, h: h * amount})
      this.addEvent([Protocol.INPUT_EV_MOVE, pos.w, pos.h])
      if (this.lastMouseWorld) {
        this.lastMouseWorld[0] -= pos.w
        this.lastMouseWorld[1] -= pos.h
      }
    }

    if (this.ZOOM_IN && this.ZOOM_OUT) {
      // cancel each other out
    } else if (this.ZOOM_IN) {
      if (this.viewport.canZoom('in')) {
        const target = this.lastMouseWorld || this._canvasCenter()
        this.addEvent([Protocol.INPUT_EV_ZOOM_IN, ...target])
      }
    } else if (this.ZOOM_OUT) {
      if (this.viewport.canZoom('out')) {
        const target = this.lastMouseWorld || this._canvasCenter()
        this.addEvent([Protocol.INPUT_EV_ZOOM_OUT, ...target])
      }
    }
  }

  setHotkeys (state: boolean) {
    this.KEYS_ON = state
  }
}
