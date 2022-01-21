import { Camera } from '../src/frontend/Camera'

test('test input stuff', () => {
  const viewport = new Camera()
  viewport.reset()

  let expected: any
  let actual: any
  let _last_mouse_down: any = null

  let evts: any[] = [];

  let set_events = (newevts: any[]) => {
    evts = newevts.map(evt => {
      // const pos2 = {x: evt.clientX, y: evt.clientY}
      // return { type: evt.type, pos: pos2}
      const pos = viewport.viewportToWorld({x: evt.clientX, y: evt.clientY})
      return { type: evt.type, pos }
    })
  }

  let update = (evts: any[]) => {
    let tmpDiffX = 0
    let tmpDiffY = 0
    for (let evt of evts) {
      if (evt.type === 'mousedown') {
        _last_mouse_down = evt.pos
      } else if (evt.type === 'mousemove') {
        if (_last_mouse_down) {
          const diffX = evt.pos.x - _last_mouse_down.x
          const diffY = evt.pos.y - _last_mouse_down.y
          const diff = viewport.worldDimToViewport({
            w: diffX,
            h: diffY,
          })
          viewport.move(diff.w, diff.h)
          _last_mouse_down = evt.pos
          tmpDiffX += diff.w
          tmpDiffY += diff.h
          _last_mouse_down.x += diff.w
          _last_mouse_down.y += diff.h
        }
      }
      console.log(evt.pos)
      console.log(_last_mouse_down)
    }
    // _last_mouse_down.x -= tmpDiffX
    // _last_mouse_down.y -= tmpDiffY
  }

  set_events([
    { type: 'mousedown', clientX: 100, clientY: 100 }, // put mouse to 100/100
  ])
  update(evts)

  expected = { x: 0, y: 0, curZoom: 1 }
  actual = viewport.snapshot()
  expect(actual).toStrictEqual(expected)

  set_events([
    { type: 'mousemove', clientX: 110, clientY: 110 }, // move mouse to 110/110
  ])
  expected = [{type: 'mousemove', pos: {x: 110, y: 110}}]
  actual = evts
  expect(actual).toStrictEqual(expected)

  update(evts)

  // after update the viewport position moved!
  expected = { x: 10, y: 10, curZoom: 1 }
  actual = viewport.snapshot()
  expect(actual).toStrictEqual(expected)

  // the last mouse world is now 120/120 (actual pos 110/110 + the coords of the viewport 10/10)
  expected = { x: 120, y: 120 }
  actual = _last_mouse_down
  expect(actual).toStrictEqual(expected)

  // viewport: 10/10
  // mouse: 120/120 = 110/110 ....
  set_events([
    { type: 'mousemove', clientX: 120, clientY: 120 }, // move mouse to 120/120
    { type: 'mousemove', clientX: 130, clientY: 130 }, // move mouse to 120/120
  ])
  expected = [
    {type: 'mousemove', pos: {x: 110, y: 110}},
    {type: 'mousemove', pos: {x: 120, y: 120}},
  ]
  actual = evts
  expect(actual).toStrictEqual(expected)

  update(evts)

  // now last mouse should be 120/120
  expected = { x: 140, y: 140 }
  actual = _last_mouse_down
  expect(actual).toStrictEqual(expected)

  expected = { x: 20, y: 20, curZoom: 1 }
  actual = viewport.snapshot()
  expect(actual).toStrictEqual(expected)

  set_events([
    { type: 'mousemove', clientX: 110, clientY: 110 },
    { type: 'mousemove', clientX: 100, clientY: 100 },
  ])
  expected = [
    {type: 'mousemove', pos: {x: 90, y: 90}},
    {type: 'mousemove', pos: {x: 80, y: 80}},
  ]
  actual = evts
  expect(actual).toStrictEqual(expected)

  update(evts)

  expected = { x: 10, y: 10, curZoom: 1 }
  actual = viewport.snapshot()
  expect(actual).toStrictEqual(expected)

  set_events([
    { type: 'mousemove', clientX: 160, clientY: 160 },
    { type: 'mousemove', clientX: 150, clientY: 150 },
  ])
  expected = [
    {type: 'mousemove', pos: {x: 150, y: 150}},
    {type: 'mousemove', pos: {x: 140, y: 140}},
  ]
  actual = evts
  expect(actual).toStrictEqual(expected)

  update(evts)

  expected = { x: 0, y: 0, curZoom: 1 }
  actual = viewport.snapshot()
  expect(actual).toStrictEqual(expected)
})
