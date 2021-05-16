"use strict"

interface GameLoopOptions {
  fps?: number
  slow?: number
  update: (step: number) => any
  render: (passed: number) => any
}
export const run = (options: GameLoopOptions) => {
  const fps = options.fps || 60
  const slow = options.slow || 1
  const update = options.update
  const render = options.render
  const raf = window.requestAnimationFrame
  const step = 1 / fps
  const slowStep = slow * step

  let now
  let dt = 0
  let last = window.performance.now()

  const frame = () => {
    now = window.performance.now()
    dt = dt + Math.min(1, (now - last) / 1000) // duration capped at 1.0 seconds
    while (dt > slowStep) {
      dt = dt - slowStep
      update(step)
    }
    render(dt / slow)
    last = now
    raf(frame)
  }

  raf(frame)
}

export default {
  run
}
