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

  let lastMouse: [number, number]|null = null
  canvas.addEventListener('mousedown', (ev) => {
    lastMouse = mousePos(ev)
    if (ev.button === 0) {
      addEvent([Protocol.INPUT_EV_MOUSE_DOWN, ...lastMouse])
    }
  })

  canvas.addEventListener('mouseup', (ev) => {
    lastMouse = mousePos(ev)
    if (ev.button === 0) {
      addEvent([Protocol.INPUT_EV_MOUSE_UP, ...lastMouse])
    }
  })

  canvas.addEventListener('mousemove', (ev) => {
    lastMouse = mousePos(ev)
    addEvent([Protocol.INPUT_EV_MOUSE_MOVE, ...lastMouse])
  })

  canvas.addEventListener('wheel', (ev) => {
    lastMouse = mousePos(ev)
    if (viewport.canZoom(ev.deltaY < 0 ? 'in' : 'out')) {
      const evt = ev.deltaY < 0
        ? Protocol.INPUT_EV_ZOOM_IN
        : Protocol.INPUT_EV_ZOOM_OUT
      addEvent([evt, ...lastMouse])
    }
  })

  window.addEventListener('keydown', (ev: KeyboardEvent) => key(true, ev))
  window.addEventListener('keyup', (ev: KeyboardEvent) => key(false, ev))

  window.addEventListener('keypress', (ev: KeyboardEvent) => {
    if (!KEYS_ON) {
      return
    }
    if (ev.code === 'Space') {
      addEvent([Protocol.INPUT_EV_TOGGLE_PREVIEW])
    }

    if (MODE === MODE_REPLAY) {
      if (ev.code === 'KeyI') {
        addEvent([Protocol.INPUT_EV_REPLAY_SPEED_UP])
      }

      if (ev.code === 'KeyO') {
        addEvent([Protocol.INPUT_EV_REPLAY_SPEED_DOWN])
      }

      if (ev.code === 'KeyP') {
        addEvent([Protocol.INPUT_EV_REPLAY_TOGGLE_PAUSE])
      }
    }
    if (ev.code === 'KeyF') {
      addEvent([Protocol.INPUT_EV_TOGGLE_FIXED_PIECES])
    }
    if (ev.code === 'KeyG') {
      addEvent([Protocol.INPUT_EV_TOGGLE_LOOSE_PIECES])
    }
    if (ev.code === 'KeyM') {
      addEvent([Protocol.INPUT_EV_TOGGLE_SOUNDS])
    }
    if (ev.code === 'KeyN') {
      addEvent([Protocol.INPUT_EV_TOGGLE_PLAYER_NAMES])
    }
    if (ev.code === 'KeyC') {
      addEvent([Protocol.INPUT_EV_CENTER_FIT_PUZZLE])
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
      if (lastMouse) {
        lastMouse[0] -= pos.w
        lastMouse[1] -= pos.h
      }
    }

    if (ZOOM_IN && ZOOM_OUT) {
      // cancel each other out
    } else if (ZOOM_IN) {
      if (viewport.canZoom('in')) {
        const target = lastMouse || canvasCenter()
        addEvent([Protocol.INPUT_EV_ZOOM_IN, ...target])
      }
    } else if (ZOOM_OUT) {
      if (viewport.canZoom('out')) {
        const target = lastMouse || canvasCenter()
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
