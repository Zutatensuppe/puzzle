import Protocol from "../common/Protocol"
import { GameEvent } from "../common/Types"
import { Camera, Snapshot } from "./Camera"
import { MODE_REPLAY } from "./game"

function EventAdapter (
  canvas: HTMLCanvasElement,
  window: Window,
  viewport: Camera,
  MODE: string
) {
  let events: Array<GameEvent> = []

  let KEYS_ON = true

  let LEFT = false
  let RIGHT = false
  let UP = false
  let DOWN = false
  let ZOOM_IN = false
  let ZOOM_OUT = false
  let SHIFT = false

  const _toWorldPoint = (x: number, y: number): [number, number] => {
    const pos = viewport.viewportToWorld({x, y})
    return [pos.x, pos.y]
  }
  const _toWorldDim = (w: number, h: number): [number, number] => {
    const dim = viewport.viewportDimToWorld({ w, h })
    return [ dim.w, dim.h ]
  }

  const _mousePos = (ev: MouseEvent) => _toWorldPoint(ev.offsetX, ev.offsetY)
  const _canvasCenter = () => _toWorldPoint(canvas.width / 2, canvas.height / 2)

  const _key = (state: boolean, ev: KeyboardEvent) => {
    if (!KEYS_ON) {
      return
    }

    if (ev.code === 'ShiftLeft' || ev.code === 'ShiftRight') {
      SHIFT = state
    } else if (ev.code === 'ArrowUp' || ev.code === 'KeyW') {
      UP = state
    } else if (ev.code === 'ArrowDown' || ev.code === 'KeyS') {
      DOWN = state
    } else if (ev.code === 'ArrowLeft' || ev.code === 'KeyA') {
      LEFT = state
    } else if (ev.code === 'ArrowRight' || ev.code === 'KeyD') {
      RIGHT = state
    } else if (ev.code === 'KeyQ') {
      ZOOM_OUT = state
    } else if (ev.code === 'KeyE') {
      ZOOM_IN = state
    }
  }

  let mouseDown: boolean = false
  let lastMouseRaw: [number, number]|null = null
  let lastMouseWorld: [number, number]|null = null

  const _onMouseDown = (ev: MouseEvent) => {
    lastMouseWorld = _mousePos(ev)
    lastMouseRaw = [ev.offsetX, ev.offsetY]
    if (ev.button === 0) {
      mouseDown = true
      addEvent([Protocol.INPUT_EV_MOUSE_DOWN, ...lastMouseWorld])
    }
  }

  const _onMouseUp = (ev: MouseEvent) => {
    lastMouseWorld = _mousePos(ev)
    lastMouseRaw = [ev.offsetX, ev.offsetY]
    if (ev.button === 0) {
      mouseDown = false
      addEvent([Protocol.INPUT_EV_MOUSE_UP, ...lastMouseWorld])
    }
  }

  const _onMouseMove = (ev: MouseEvent) => {
    if (!lastMouseRaw) {
      return
    }
    lastMouseWorld = _mousePos(ev)
    const diffWorld = _toWorldDim(
      -(lastMouseRaw[0] - ev.offsetX),
      -(lastMouseRaw[1] - ev.offsetY),
    )
    addEvent([Protocol.INPUT_EV_MOUSE_MOVE, ...lastMouseWorld, ...diffWorld, mouseDown ? 1 : 0])
    lastMouseRaw = [ev.offsetX, ev.offsetY]
  }

  const _onWheel = (ev: WheelEvent) => {
    lastMouseWorld = _mousePos(ev)
    if (viewport.canZoom(ev.deltaY < 0 ? 'in' : 'out')) {
      const evt = ev.deltaY < 0
        ? Protocol.INPUT_EV_ZOOM_IN
        : Protocol.INPUT_EV_ZOOM_OUT
      addEvent([evt, ...lastMouseWorld])
    }
  }

  const _onKeyUp = (ev: KeyboardEvent) => _key(true, ev)
  const _onKeyDown = (ev: KeyboardEvent) => _key(false, ev)
  const _onKeyPress = (ev: KeyboardEvent) => {
    if (!KEYS_ON) {
      return
    }

    if (MODE === MODE_REPLAY) {
      if (ev.code === 'KeyI') {
        addEvent([Protocol.INPUT_EV_REPLAY_SPEED_UP])
      } else if (ev.code === 'KeyO') {
        addEvent([Protocol.INPUT_EV_REPLAY_SPEED_DOWN])
      } else if (ev.code === 'KeyP') {
        addEvent([Protocol.INPUT_EV_REPLAY_TOGGLE_PAUSE])
      }
    }

    if (ev.code === 'KeyH') {
      addEvent([Protocol.INPUT_EV_TOGGLE_INTERFACE])
    } else if (ev.code === 'Space') {
      addEvent([Protocol.INPUT_EV_TOGGLE_PREVIEW])
    } else if (ev.code === 'KeyF') {
      addEvent([Protocol.INPUT_EV_TOGGLE_FIXED_PIECES])
    } else if (ev.code === 'KeyG') {
      addEvent([Protocol.INPUT_EV_TOGGLE_LOOSE_PIECES])
    } else if (ev.code === 'KeyM') {
      addEvent([Protocol.INPUT_EV_TOGGLE_SOUNDS])
    } else if (ev.code === 'KeyN') {
      addEvent([Protocol.INPUT_EV_TOGGLE_PLAYER_NAMES])
    } else if (ev.code === 'KeyT') {
      addEvent([Protocol.INPUT_EV_TOGGLE_TABLE])
    } else if (ev.code === 'KeyC') {
      addEvent([Protocol.INPUT_EV_CENTER_FIT_PUZZLE])
    } else {
      for (let i = 0; i <= 9; i++) {
        if (ev.code === `Digit${i}`) {
          // store or restore pos+zoom in slot i
          const evt = ev.shiftKey ? Protocol.INPUT_EV_STORE_POS : Protocol.INPUT_EV_RESTORE_POS
          addEvent([evt, i])
          break;
        }
      }
    }
  }

  const registerEvents = () => {
    canvas.addEventListener('mousedown', _onMouseDown)
    canvas.addEventListener('mouseup', _onMouseUp)
    canvas.addEventListener('mousemove', _onMouseMove)
    canvas.addEventListener('wheel', _onWheel)
    window.addEventListener('keydown', _onKeyUp)
    window.addEventListener('keyup', _onKeyDown)
    window.addEventListener('keypress', _onKeyPress)
  }
  const unregisterEvents = () => {
    canvas.removeEventListener('mousedown', _onMouseDown)
    canvas.removeEventListener('mouseup', _onMouseUp)
    canvas.removeEventListener('mousemove', _onMouseMove)
    canvas.removeEventListener('wheel', _onWheel)
    window.removeEventListener('keydown', _onKeyUp)
    window.removeEventListener('keyup', _onKeyDown)
    window.removeEventListener('keypress', _onKeyPress)
  }

  const createSnapshotEvents = (prev: Snapshot, curr: Snapshot) => {
    if (!lastMouseRaw || !lastMouseWorld) {
      return
    }

    const prevWorld = new Camera(prev).viewportToWorld({x: lastMouseRaw[0], y: lastMouseRaw[1]})
    const currWorld = new Camera(curr).viewportToWorld({x: lastMouseRaw[0], y: lastMouseRaw[1]})
    const diffWorld = [
      -(prevWorld.x - currWorld.x),
      -(prevWorld.y - currWorld.y),
    ]
    addEvent([Protocol.INPUT_EV_MOUSE_MOVE, ...lastMouseWorld, ...diffWorld, mouseDown ? 1 : 0])
  }

  const addEvent = (event: GameEvent) => {
    events.push(event)
  }

  const consumeAll = (): GameEvent[] => {
    if (events.length === 0) {
      return []
    }
    const all = events.slice()
    events = []
    return all
  }

  const createKeyEvents = (): void => {
    const w = (LEFT ? 1 : 0) - (RIGHT ? 1 : 0)
    const h = (UP ? 1 : 0) - (DOWN ? 1 : 0)
    if (w !== 0 || h !== 0) {
      const amount = (SHIFT ? 24 : 12) * Math.sqrt(viewport.getCurrentZoom())
      const pos = viewport.viewportDimToWorld({w: w * amount, h: h * amount})
      addEvent([Protocol.INPUT_EV_MOVE, pos.w, pos.h])
      if (lastMouseWorld) {
        lastMouseWorld[0] -= pos.w
        lastMouseWorld[1] -= pos.h
      }
    }

    if (ZOOM_IN && ZOOM_OUT) {
      // cancel each other out
    } else if (ZOOM_IN) {
      if (viewport.canZoom('in')) {
        const target = lastMouseWorld || _canvasCenter()
        addEvent([Protocol.INPUT_EV_ZOOM_IN, ...target])
      }
    } else if (ZOOM_OUT) {
      if (viewport.canZoom('out')) {
        const target = lastMouseWorld || _canvasCenter()
        addEvent([Protocol.INPUT_EV_ZOOM_OUT, ...target])
      }
    }
  }

  const setHotkeys = (state: boolean) => {
    KEYS_ON = state
  }

  return {
    registerEvents,
    unregisterEvents,
    addEvent,
    consumeAll,
    createKeyEvents,
    createSnapshotEvents,
    setHotkeys,
  }
}

export default EventAdapter
