import Protocol from "../common/Protocol"
import { GameEvent } from "../common/Types"
import { MODE_REPLAY } from "./game"

function EventAdapter (
  canvas: HTMLCanvasElement,
  window: any,
  viewport: any,
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

  const toWorldPoint = (x: number, y: number): [number, number] => {
    const pos = viewport.viewportToWorld({x, y})
    return [pos.x, pos.y]
  }
  const toWorldDim = (w: number, h: number): [number, number] => {
    const dim = viewport.viewportDimToWorld({ w, h })
    return [ dim.w, dim.h ]
  }

  const mousePos = (ev: MouseEvent) => toWorldPoint(ev.offsetX, ev.offsetY)
  const canvasCenter = () => toWorldPoint(canvas.width / 2, canvas.height / 2)

  const key = (state: boolean, ev: KeyboardEvent) => {
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
  canvas.addEventListener('mousedown', (ev) => {
    lastMouseWorld = mousePos(ev)
    lastMouseRaw = [ev.offsetX, ev.offsetY]
    if (ev.button === 0) {
      mouseDown = true
      addEvent([Protocol.INPUT_EV_MOUSE_DOWN, ...lastMouseWorld])
    }
  })

  canvas.addEventListener('mouseup', (ev) => {
    lastMouseWorld = mousePos(ev)
    lastMouseRaw = [ev.offsetX, ev.offsetY]
    if (ev.button === 0) {
      mouseDown = false
      addEvent([Protocol.INPUT_EV_MOUSE_UP, ...lastMouseWorld])
    }
  })

  canvas.addEventListener('mousemove', (ev) => {
    if (!lastMouseRaw) {
      return
    }
    lastMouseWorld = mousePos(ev)
    const diffWorld = toWorldDim(
      -(lastMouseRaw[0] - ev.offsetX),
      -(lastMouseRaw[1] - ev.offsetY),
    )
    addEvent([Protocol.INPUT_EV_MOUSE_MOVE, ...lastMouseWorld, ...diffWorld, mouseDown ? 1 : 0])
    lastMouseRaw = [ev.offsetX, ev.offsetY]
  })

  canvas.addEventListener('wheel', (ev) => {
    lastMouseWorld = mousePos(ev)
    if (viewport.canZoom(ev.deltaY < 0 ? 'in' : 'out')) {
      const evt = ev.deltaY < 0
        ? Protocol.INPUT_EV_ZOOM_IN
        : Protocol.INPUT_EV_ZOOM_OUT
      addEvent([evt, ...lastMouseWorld])
    }
  })

  window.addEventListener('keydown', (ev: KeyboardEvent) => key(true, ev))
  window.addEventListener('keyup', (ev: KeyboardEvent) => key(false, ev))

  window.addEventListener('keypress', (ev: KeyboardEvent) => {
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

    if (ev.code === 'Space') {
      addEvent([Protocol.INPUT_EV_TOGGLE_PREVIEW])
    } else if (ev.code === 'KeyF') {
      addEvent([Protocol.INPUT_EV_TOGGLE_FIXED_PIECES])
    } else if (ev.code === 'KeyG') {
      addEvent([Protocol.INPUT_EV_TOGGLE_LOOSE_PIECES])
    } else if (ev.code === 'KeyM') {
      addEvent([Protocol.INPUT_EV_TOGGLE_SOUNDS])
    } else if (ev.code === 'KeyN') {
      addEvent([Protocol.INPUT_EV_TOGGLE_PLAYER_NAMES])
    } else if (ev.code === 'KeyC') {
      addEvent([Protocol.INPUT_EV_CENTER_FIT_PUZZLE])
    } else if (ev.code === 'Digit1') {
      // store or restore pos+zoom in slot 1
      const evt = ev.shiftKey ? Protocol.INPUT_EV_STORE_POS : Protocol.INPUT_EV_RESTORE_POS
      addEvent([evt, 1])
    } else if (ev.code === 'Digit2') {
      // store or restore pos+zoom in slot 2
      const evt = ev.shiftKey ? Protocol.INPUT_EV_STORE_POS : Protocol.INPUT_EV_RESTORE_POS
      addEvent([evt, 2])
    } else if (ev.code === 'Digit3') {
      // store or restore pos+zoom in slot 3
      const evt = ev.shiftKey ? Protocol.INPUT_EV_STORE_POS : Protocol.INPUT_EV_RESTORE_POS
      addEvent([evt, 3])
    }
  })

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
        const target = lastMouseWorld || canvasCenter()
        addEvent([Protocol.INPUT_EV_ZOOM_IN, ...target])
      }
    } else if (ZOOM_OUT) {
      if (viewport.canZoom('out')) {
        const target = lastMouseWorld || canvasCenter()
        addEvent([Protocol.INPUT_EV_ZOOM_OUT, ...target])
      }
    }
  }

  const setHotkeys = (state: boolean) => {
    KEYS_ON = state
  }

  return {
    addEvent,
    consumeAll,
    createKeyEvents,
    setHotkeys,
  }
}

export default EventAdapter
