import { describe, expect, it } from 'vitest'
import { EventAdapter } from './EventAdapter'
import { GAME_EVENT_TYPE } from '@common/Protocol'
import type { GameEvent } from '@common/Types'
import { Camera } from '@common/Camera'
import type { GameInterface } from './Game'
import type { PlayerSettings } from './PlayerSettings'

class FakeCanvas extends EventTarget {
  public width = 100
  public height = 100
  public captured: Set<number> = new Set()

  getBoundingClientRect () {
    // canvas backing store is 2x the layout size
    return { left: 10, top: 20, width: 50, height: 50, right: 60, bottom: 70, x: 10, y: 20, toJSON: () => ({}) } as DOMRect
  }

  setPointerCapture (pointerId: number) {
    this.captured.add(pointerId)
  }

  releasePointerCapture (pointerId: number) {
    this.captured.delete(pointerId)
    // Simulate immediate capture loss to catch duplicate cleanup on reentrant events.
    this.dispatchEvent(pointerEvent('lostpointercapture', { pointerId }))
  }

  hasPointerCapture (pointerId: number) {
    return this.captured.has(pointerId)
  }
}

const pointerEvent = (type: string, fields: Record<string, unknown> = {}): PointerEvent => {
  const ev = new Event(type) as PointerEvent
  Object.assign(ev, {
    pointerId: 1,
    pointerType: 'touch',
    isPrimary: true,
    button: 0,
    clientX: 0,
    clientY: 0,
    ...fields,
  })
  return ev
}

const setup = () => {
  const canvas = new FakeCanvas()
  const win = new EventTarget()
  const viewport = new Camera()
  const game = {
    getCanvas: () => canvas,
    getWindow: () => win,
    getViewport: () => viewport,
    initViewport: () => {},
    getMode: () => 'game',
  } as unknown as GameInterface
  const playerSettings = {
    mouseRotate: () => false,
  } as unknown as PlayerSettings
  const adapter = new EventAdapter(game, playerSettings)
  adapter.registerEvents()
  return { canvas, win, viewport, adapter }
}

const fire = (canvas: FakeCanvas, type: string, fields: Record<string, unknown> = {}) => {
  canvas.dispatchEvent(pointerEvent(type, fields))
}

describe('EventAdapter.ts', () => {
  it('touch down -> move -> up produces mouse down/move/up events with world coords', () => {
    const { canvas, adapter } = setup()

    // clientX 20 -> (20-10)*100/50 = 20, clientY 30 -> (30-20)*100/50 = 20
    fire(canvas, 'pointerdown', { clientX: 20, clientY: 30 })
    expect(canvas.hasPointerCapture(1)).toBe(true)

    // first move after down emits move with diff from down pos
    fire(canvas, 'pointermove', { clientX: 30, clientY: 40 })
    fire(canvas, 'pointerup', { clientX: 30, clientY: 40 })
    expect(canvas.hasPointerCapture(1)).toBe(false)

    expect(adapter.consumeAll()).toEqual([
      [GAME_EVENT_TYPE.INPUT_EV_MOUSE_DOWN, 20, 20],
      [GAME_EVENT_TYPE.INPUT_EV_MOUSE_MOVE, 40, 40, 20, 20, 1],
      [GAME_EVENT_TYPE.INPUT_EV_MOUSE_UP, 40, 40],
    ])
  })

  it('reports moves outside the canvas rect while captured', () => {
    const { canvas, adapter } = setup()
    fire(canvas, 'pointerdown', { clientX: 20, clientY: 30 })
    // outside rect: clientX -10 -> (-10-10)*2 = -40
    fire(canvas, 'pointermove', { clientX: -10, clientY: 100 })

    const evts = adapter.consumeAll()
    expect(evts[0]).toEqual([GAME_EVENT_TYPE.INPUT_EV_MOUSE_DOWN, 20, 20])
    expect(evts[1]).toEqual([GAME_EVENT_TYPE.INPUT_EV_MOUSE_MOVE, -40, 160, -60, 140, 1])
  })

  it('mouse pointer sequence still works', () => {
    const { canvas, adapter } = setup()
    fire(canvas, 'pointerdown', { pointerType: 'mouse', clientX: 20, clientY: 30 })
    fire(canvas, 'pointermove', { pointerType: 'mouse', clientX: 25, clientY: 35 })
    fire(canvas, 'pointerup', { pointerType: 'mouse', clientX: 25, clientY: 35 })

    expect(adapter.consumeAll()).toEqual([
      [GAME_EVENT_TYPE.INPUT_EV_MOUSE_DOWN, 20, 20],
      [GAME_EVENT_TYPE.INPUT_EV_MOUSE_MOVE, 30, 30, 10, 10, 1],
      [GAME_EVENT_TYPE.INPUT_EV_MOUSE_UP, 30, 30],
    ])
  })

  it('mouse hover moves emit events while stray touch moves are ignored', () => {
    const { canvas, adapter } = setup()
    // hover: first move initializes position without event
    fire(canvas, 'pointermove', { pointerType: 'mouse', clientX: 20, clientY: 30 })
    expect(adapter.consumeAll()).toEqual([])
    fire(canvas, 'pointermove', { pointerType: 'mouse', clientX: 25, clientY: 35 })
    expect(adapter.consumeAll()).toEqual([
      [GAME_EVENT_TYPE.INPUT_EV_MOUSE_MOVE, 30, 30, 10, 10, 0],
    ])
    // a touch move without an active pointer is ignored entirely
    fire(canvas, 'pointermove', { pointerType: 'touch', pointerId: 7, clientX: 40, clientY: 40 })
    expect(adapter.consumeAll()).toEqual([])
  })

  it('ignores secondary touches while a pointer is active', () => {
    const { canvas, adapter } = setup()
    fire(canvas, 'pointerdown', { pointerId: 1, clientX: 20, clientY: 30 })
    fire(canvas, 'pointerdown', { pointerId: 2, clientX: 50, clientY: 50 })
    fire(canvas, 'pointermove', { pointerId: 2, clientX: 55, clientY: 55 })
    fire(canvas, 'pointerup', { pointerId: 2, clientX: 55, clientY: 55 })
    fire(canvas, 'pointermove', { pointerId: 1, clientX: 25, clientY: 35 })
    fire(canvas, 'pointerup', { pointerId: 1, clientX: 25, clientY: 35 })

    expect(adapter.consumeAll()).toEqual([
      [GAME_EVENT_TYPE.INPUT_EV_MOUSE_DOWN, 20, 20],
      [GAME_EVENT_TYPE.INPUT_EV_MOUSE_MOVE, 30, 30, 10, 10, 1],
      [GAME_EVENT_TYPE.INPUT_EV_MOUSE_UP, 30, 30],
    ])
  })

  it('ignores non-primary and non-left-button pointerdown', () => {
    const { canvas, adapter } = setup()
    fire(canvas, 'pointerdown', { isPrimary: false, clientX: 20, clientY: 30 })
    fire(canvas, 'pointerdown', { button: 2, clientX: 20, clientY: 30 })
    expect(adapter.consumeAll()).toEqual([])
    expect(canvas.hasPointerCapture(1)).toBe(false)
  })

  it('queues input events in order with pointer events', () => {
    const { canvas, adapter } = setup()
    fire(canvas, 'pointerdown', { clientX: 20, clientY: 30 })
    adapter.addEvent([GAME_EVENT_TYPE.INPUT_EV_ROTATE, 1])
    fire(canvas, 'pointerup', { clientX: 20, clientY: 30 })

    expect(adapter.consumeAll()).toEqual([
      [GAME_EVENT_TYPE.INPUT_EV_MOUSE_DOWN, 20, 20],
      [GAME_EVENT_TYPE.INPUT_EV_ROTATE, 1],
      [GAME_EVENT_TYPE.INPUT_EV_MOUSE_UP, 20, 20],
    ])
  })

  it('pointercancel produces a single mouse up and drops the drag', () => {
    const { canvas, adapter } = setup()
    fire(canvas, 'pointerdown', { clientX: 20, clientY: 30 })
    fire(canvas, 'pointercancel', {})
    expect(canvas.hasPointerCapture(1)).toBe(false)

    expect(adapter.consumeAll()).toEqual([
      [GAME_EVENT_TYPE.INPUT_EV_MOUSE_DOWN, 20, 20],
      [GAME_EVENT_TYPE.INPUT_EV_MOUSE_UP, 20, 20],
    ])

    // subsequent unrelated events are ignored
    fire(canvas, 'pointerup', {})
    expect(adapter.consumeAll()).toEqual([])
  })

  it('lostpointercapture after pointerup does not double-fire mouse up', () => {
    const { canvas, adapter } = setup()
    fire(canvas, 'pointerdown', { clientX: 20, clientY: 30 })
    fire(canvas, 'pointerup', { clientX: 20, clientY: 30 })
    fire(canvas, 'lostpointercapture', {})

    expect(adapter.consumeAll()).toEqual([
      [GAME_EVENT_TYPE.INPUT_EV_MOUSE_DOWN, 20, 20],
      [GAME_EVENT_TYPE.INPUT_EV_MOUSE_UP, 20, 20],
    ])
  })

  it('window blur drops an active drag', () => {
    const { canvas, win, adapter } = setup()
    fire(canvas, 'pointerdown', { clientX: 20, clientY: 30 })
    win.dispatchEvent(new Event('blur'))
    expect(canvas.hasPointerCapture(1)).toBe(false)
    expect(adapter.consumeAll()).toEqual([
      [GAME_EVENT_TYPE.INPUT_EV_MOUSE_DOWN, 20, 20],
      [GAME_EVENT_TYPE.INPUT_EV_MOUSE_UP, 20, 20],
    ])
  })

  it('unregisterEvents releases capture, ends drag, and removes listeners', () => {
    const { canvas, adapter } = setup()
    fire(canvas, 'pointerdown', { clientX: 20, clientY: 30 })
    adapter.unregisterEvents()
    expect(canvas.hasPointerCapture(1)).toBe(false)

    const evts: GameEvent[] = adapter.consumeAll()
    expect(evts).toEqual([
      [GAME_EVENT_TYPE.INPUT_EV_MOUSE_DOWN, 20, 20],
      [GAME_EVENT_TYPE.INPUT_EV_MOUSE_UP, 20, 20],
    ])

    // listeners removed: no more events and no double firing after re-register
    fire(canvas, 'pointerdown', { clientX: 20, clientY: 30 })
    expect(adapter.consumeAll()).toEqual([])
    adapter.registerEvents()
    fire(canvas, 'pointerdown', { clientX: 20, clientY: 30 })
    const evts2 = adapter.consumeAll()
    expect(evts2).toEqual([
      [GAME_EVENT_TYPE.INPUT_EV_MOUSE_DOWN, 20, 20],
    ])
    adapter.unregisterEvents()
  })
})
