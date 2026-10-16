import { describe, expect, it } from 'vitest'
import { FrameClock, frameAt } from './FrameClock'

describe('FrameClock.ts', () => {
  describe('frameAt', () => {
    it('shows the first Frame at the start', () => {
      expect(frameAt([100, 100, 100], 0)).toEqual({ frame: 0, msUntilNextFrame: 100 })
    })

    ;[
      { elapsedMs: 99, expected: { frame: 0, msUntilNextFrame: 1 } },
      { elapsedMs: 100, expected: { frame: 1, msUntilNextFrame: 100 } },
      { elapsedMs: 150, expected: { frame: 1, msUntilNextFrame: 50 } },
      { elapsedMs: 199.5, expected: { frame: 1, msUntilNextFrame: 0.5 } },
      { elapsedMs: 200, expected: { frame: 2, msUntilNextFrame: 100 } },
      { elapsedMs: 299, expected: { frame: 2, msUntilNextFrame: 1 } },
    ].forEach(({ elapsedMs, expected }) => it(`changes Frame exactly at the boundary (${elapsedMs} ms)`, () => {
      expect(frameAt([100, 100, 100], elapsedMs)).toEqual(expected)
    }))

    ;[
      { elapsedMs: 300, expected: { frame: 0, msUntilNextFrame: 100 } },
      { elapsedMs: 350, expected: { frame: 0, msUntilNextFrame: 50 } },
      { elapsedMs: 400, expected: { frame: 1, msUntilNextFrame: 100 } },
      { elapsedMs: 599, expected: { frame: 2, msUntilNextFrame: 1 } },
      { elapsedMs: 600, expected: { frame: 0, msUntilNextFrame: 100 } },
    ].forEach(({ elapsedMs, expected }) => it(`loops over the total duration (${elapsedMs} ms)`, () => {
      expect(frameAt([100, 100, 100], elapsedMs)).toEqual(expected)
    }))

    it('jumps to the correct Frame after a long gap', () => {
      // 1 hour in the background: 3_600_000 ms = 12_000 loops of 300 ms, plus 250 ms
      expect(frameAt([100, 100, 100], 3_600_250)).toEqual({ frame: 2, msUntilNextFrame: 50 })
    })

    ;[
      { elapsedMs: 19, expected: { frame: 0, msUntilNextFrame: 1 } },
      { elapsedMs: 20, expected: { frame: 1, msUntilNextFrame: 500 } },
      { elapsedMs: 519, expected: { frame: 1, msUntilNextFrame: 1 } },
      { elapsedMs: 520, expected: { frame: 2, msUntilNextFrame: 80 } },
      { elapsedMs: 600, expected: { frame: 0, msUntilNextFrame: 20 } },
    ].forEach(({ elapsedMs, expected }) => it(`respects uneven Frame durations (${elapsedMs} ms)`, () => {
      expect(frameAt([20, 500, 80], elapsedMs)).toEqual(expected)
    }))

    ;[0, 100, 3_600_000].forEach(elapsedMs => it(`never changes the Frame of a single-Frame image (${elapsedMs} ms)`, () => {
      expect(frameAt([100], elapsedMs)).toEqual({ frame: 0, msUntilNextFrame: Infinity })
    }))
  })

  describe('FrameClock', () => {
    it('is due for a Frame change exactly when the shown Frame ends', () => {
      const clock = new FrameClock([100, 100, 100], 1000)
      expect(clock.frame).toBe(0)
      expect(clock.isFrameChangeDue(1099)).toBe(false)
      expect(clock.isFrameChangeDue(1100)).toBe(true)
    })

    it('moves to the next Frame and is not due again until that Frame ends', () => {
      const clock = new FrameClock([100, 100, 100], 1000)
      expect(clock.update(1120)).toBe(true)
      expect(clock.frame).toBe(1)
      expect(clock.isFrameChangeDue(1199)).toBe(false)
      expect(clock.isFrameChangeDue(1200)).toBe(true)
    })

    it('reports no change when updated within the shown Frame', () => {
      const clock = new FrameClock([100, 100, 100], 1000)
      expect(clock.update(1050)).toBe(false)
      expect(clock.frame).toBe(0)
    })

    it('jumps to the correct Frame after a long gap instead of advancing one Frame', () => {
      const clock = new FrameClock([100, 100, 100], 1000)
      // tab in the background for 10 s: 10_450 ms elapsed, 34 loops of 300 ms plus 250 ms
      expect(clock.update(11_450)).toBe(true)
      expect(clock.frame).toBe(2)
      expect(clock.isFrameChangeDue(11_499)).toBe(false)
      expect(clock.isFrameChangeDue(11_500)).toBe(true)
    })

    it('is never due for a Frame change on a single-Frame image', () => {
      const clock = new FrameClock([100], 1000)
      expect(clock.isFrameChangeDue(1100)).toBe(false)
      expect(clock.update(3_601_000)).toBe(false)
      expect(clock.isFrameChangeDue(3_601_000 + 3_600_000)).toBe(false)
    })
  })
})
