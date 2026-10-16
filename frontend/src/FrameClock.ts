/**
 * Animation timing of an Animated Image, shared by both renderers.
 *
 * The shown Frame is derived from wall-clock time (elapsed time mod total
 * duration), so after a background tab or a hiccup the animation jumps to
 * the correct Frame instead of catching up in slow motion.
 */

export interface FrameClockReading {
  frame: number
  msUntilNextFrame: number
}

/**
 * Frame shown `elapsedMs` after the animation started, given each Frame's
 * display duration. A single-Frame image never changes its Frame.
 */
export const frameAt = (durations: readonly number[], elapsedMs: number): FrameClockReading => {
  if (durations.length <= 1) {
    return { frame: 0, msUntilNextFrame: Infinity }
  }
  const totalMs = durations.reduce((sum, ms) => sum + ms, 0)
  const loopMs = elapsedMs % totalMs
  let frameEnd = 0
  for (let frame = 0; frame < durations.length; frame++) {
    frameEnd += durations[frame]
    if (loopMs < frameEnd) {
      return { frame, msUntilNextFrame: frameEnd - loopMs }
    }
  }
  // only reachable through floating point rounding at the very end of a loop
  return { frame: 0, msUntilNextFrame: durations[0] }
}

/**
 * Remembers which Frame a renderer currently shows, so the game loop can ask
 * whether a Frame change is due without recomputing the Frame every tick.
 */
export class FrameClock {
  private shownFrame: number
  private nextChangeAtMs: number

  constructor(
    private readonly durations: readonly number[],
    private readonly startMs: number,
  ) {
    const reading = frameAt(durations, 0)
    this.shownFrame = reading.frame
    this.nextChangeAtMs = startMs + reading.msUntilNextFrame
  }

  get frame(): number {
    return this.shownFrame
  }

  isFrameChangeDue(nowMs: number): boolean {
    return nowMs >= this.nextChangeAtMs
  }

  /** Moves to the Frame shown at `nowMs`. Returns whether the shown Frame changed. */
  update(nowMs: number): boolean {
    const reading = frameAt(this.durations, nowMs - this.startMs)
    this.nextChangeAtMs = nowMs + reading.msUntilNextFrame
    if (reading.frame === this.shownFrame) {
      return false
    }
    this.shownFrame = reading.frame
    return true
  }
}
