import { GAME_EVENT_TYPE } from '@common/Protocol'
import type { GameEvent } from '@common/Types'
import { Camera } from '@common/Camera'
import type { Snapshot } from '@common/Camera'
import type { GameInterface } from './Game'
import { MODE_REPLAY } from './GameMode'
import type { PlayerSettings } from './PlayerSettings'

export class EventAdapter {
  private events: GameEvent[] = []

  private KEYS_ON = true

  private LEFT = false
  private RIGHT = false
  private UP = false
  private DOWN = false
  private ZOOM_IN = false
  private ZOOM_OUT = false
  private ROT_LEFT = false
  private ROT_RIGHT = false
  private SHIFT = false

  private mouseDown: boolean = false
  private activePointerId: number | null = null
  private lastMouseRaw: [number, number]|null = null
  private lastMouseWorld: [number, number]|null = null

  private onResize
  private onPointerDown
  private onPointerUp
  private onPointerMove
  private onPointerEnd
  private onWheel
  private onKeyUp
  private onKeyDown
  private onKeyPress
  private onWndMouseDown
  private onWndBlur

  constructor (private game: GameInterface, private playerSettings: PlayerSettings) {
    this.onResize = this.game.initViewport.bind(this.game)
    this.onPointerDown = this._onPointerDown.bind(this)
    this.onPointerUp = this._onPointerUp.bind(this)
    this.onPointerMove = this._onPointerMove.bind(this)
    this.onPointerEnd = this._onPointerEnd.bind(this)
    this.onWheel = this._onWheel.bind(this)
    this.onKeyUp = this._onKeyUp.bind(this)
    this.onKeyDown = this._onKeyDown.bind(this)
    this.onKeyPress = this._onKeyPress.bind(this)
    this.onWndMouseDown = this._onWndMouseDown.bind(this)
    this.onWndBlur = this._onWndBlur.bind(this)
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

  _pointerPos (ev: PointerEvent): [number, number] {
    const canvas = this.game.getCanvas()
    const rect = canvas.getBoundingClientRect()
    return [
      (ev.clientX - rect.left) * canvas.width / rect.width,
      (ev.clientY - rect.top) * canvas.height / rect.height,
    ]
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
    } else if (ev.code === 'KeyZ') {
      this.ROT_LEFT = state
    } else if (ev.code === 'KeyX') {
      this.ROT_RIGHT = state
    }
  }

  _onPointerDown (ev: PointerEvent) {
    if (!ev.isPrimary || ev.button !== 0 || this.activePointerId !== null) {
      return
    }
    const [x, y] = this._pointerPos(ev)
    this.lastMouseRaw = [x, y]
    this.lastMouseWorld = this._toWorldPoint(x, y)
    this.mouseDown = true
    this.activePointerId = ev.pointerId
    this.game.getCanvas().setPointerCapture(ev.pointerId)
    this.addEvent([GAME_EVENT_TYPE.INPUT_EV_MOUSE_DOWN, ...this.lastMouseWorld])
  }

  _onPointerUp (ev: PointerEvent) {
    if (this.activePointerId === null || ev.pointerId !== this.activePointerId) {
      return
    }
    const [x, y] = this._pointerPos(ev)
    this.lastMouseRaw = [x, y]
    this.lastMouseWorld = this._toWorldPoint(x, y)
    this._endActivePointer(ev.pointerId)
  }

  _onPointerMove (ev: PointerEvent) {
    if (this.activePointerId !== null) {
      if (ev.pointerId !== this.activePointerId) {
        return
      }
    } else if (ev.pointerType !== 'mouse' && ev.pointerType !== 'pen') {
      return
    }
    const [x, y] = this._pointerPos(ev)
    if (!this.lastMouseRaw) {
      this.lastMouseRaw = [x, y]
      this.lastMouseWorld = this._toWorldPoint(x, y)
      return
    }
    this.lastMouseWorld = this._toWorldPoint(x, y)
    const diffWorld = this._toWorldDim(x - this.lastMouseRaw[0], y - this.lastMouseRaw[1])
    this.addEvent([GAME_EVENT_TYPE.INPUT_EV_MOUSE_MOVE, ...this.lastMouseWorld, ...diffWorld, this.mouseDown ? 1 : 0])
    this.lastMouseRaw = [x, y]
  }

  _onPointerEnd (ev: PointerEvent) {
    this._endActivePointer(ev.pointerId)
  }

  _endActivePointer (pointerId: number): void {
    if (this.activePointerId !== pointerId) {
      return
    }
    this.activePointerId = null
    this.mouseDown = false
    if (this.lastMouseWorld) {
      this.addEvent([GAME_EVENT_TYPE.INPUT_EV_MOUSE_UP, ...this.lastMouseWorld])
    }
    const canvas = this.game.getCanvas()
    if (canvas.hasPointerCapture(pointerId)) {
      canvas.releasePointerCapture(pointerId)
    }
  }

  _onWheel (ev: WheelEvent) {
    this.lastMouseWorld = this._mousePos(ev)
    if (this.playerSettings.mouseRotate() && this.mouseDown) {
      if (ev.deltaY < 0) {
        this.addEvent([GAME_EVENT_TYPE.INPUT_EV_ROTATE, 0])
        this.ROT_LEFT = false
      } else {
        this.addEvent([GAME_EVENT_TYPE.INPUT_EV_ROTATE, 1])
        this.ROT_RIGHT = false
      }
    } else {
      if (this.game.getViewport().canZoom(ev.deltaY < 0 ? 'in' : 'out')) {
        const evt = ev.deltaY < 0
          ? GAME_EVENT_TYPE.INPUT_EV_ZOOM_IN
          : GAME_EVENT_TYPE.INPUT_EV_ZOOM_OUT
        this.addEvent([evt, ...this.lastMouseWorld])
      }
    }
  }

  _onKeyDown (ev: KeyboardEvent) {
    this._key(true, ev)
  }

  _onKeyUp (ev: KeyboardEvent) {
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
    } else if (ev.code === 'KeyB') {
      this.addEvent([GAME_EVENT_TYPE.INPUT_EV_TOGGLE_PUZZLE_BACKGROUND])
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

  _onWndBlur (): void {
    if (this.activePointerId !== null) {
      this._endActivePointer(this.activePointerId)
    }
  }

  registerEvents () {
    const w = this.game.getWindow()
    w.addEventListener('resize', this.onResize, { passive: true })
    w.addEventListener('keydown', this.onKeyDown, { passive: true })
    w.addEventListener('keyup', this.onKeyUp, { passive: true })
    w.addEventListener('keypress', this.onKeyPress, { passive: true })
    w.addEventListener('mousedown', this.onWndMouseDown)
    w.addEventListener('blur', this.onWndBlur, { passive: true })

    const c = this.game.getCanvas()
    c.addEventListener('pointerdown', this.onPointerDown, { passive: true })
    c.addEventListener('pointerup', this.onPointerUp, { passive: true })
    c.addEventListener('pointermove', this.onPointerMove, { passive: true })
    c.addEventListener('pointercancel', this.onPointerEnd, { passive: true })
    c.addEventListener('lostpointercapture', this.onPointerEnd, { passive: true })
    c.addEventListener('wheel', this.onWheel, { passive: true })
  }

  unregisterEvents () {
    const c = this.game.getCanvas()
    if (this.activePointerId !== null) {
      this._endActivePointer(this.activePointerId)
    }

    const w = this.game.getWindow()
    w.removeEventListener('resize', this.onResize)
    w.removeEventListener('keydown', this.onKeyDown)
    w.removeEventListener('keyup', this.onKeyUp)
    w.removeEventListener('keypress', this.onKeyPress)
    w.removeEventListener('mousedown', this.onWndMouseDown)
    w.removeEventListener('blur', this.onWndBlur)

    c.removeEventListener('pointerdown', this.onPointerDown)
    c.removeEventListener('pointerup', this.onPointerUp)
    c.removeEventListener('pointermove', this.onPointerMove)
    c.removeEventListener('pointercancel', this.onPointerEnd)
    c.removeEventListener('lostpointercapture', this.onPointerEnd)
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

    if (this.ROT_LEFT && this.ROT_RIGHT) {
      // cancel each other out
    } else if (this.ROT_LEFT) {
      this.addEvent([GAME_EVENT_TYPE.INPUT_EV_ROTATE, 0])
      this.ROT_LEFT = false
    } else if (this.ROT_RIGHT) {
      this.addEvent([GAME_EVENT_TYPE.INPUT_EV_ROTATE, 1])
      this.ROT_RIGHT = false
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
