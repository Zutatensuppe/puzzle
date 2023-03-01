const MS = 1
const SEC = MS * 1000
const MIN = SEC * 60
const HOUR = MIN * 60
const DAY = HOUR * 24

export const timestamp = (): number => {
  const d = new Date()
  return Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
    d.getUTCSeconds(),
    d.getUTCMilliseconds(),
  )
}

export const durationStr = (duration: number): string => {
  const d = Math.floor(duration / DAY)
  duration = duration % DAY

  const h = Math.floor(duration / HOUR)
  duration = duration % HOUR

  const m = Math.floor(duration / MIN)
  duration = duration % MIN

  const s = Math.floor(duration / SEC)

  return `${d}d ${h}h ${m}m ${s}s`
}

export const timeDiffStr = (
  from: number,
  to: number,
): string => durationStr(to - from)

export default {
  MS,
  SEC,
  MIN,
  HOUR,
  DAY,

  timestamp,
  timeDiffStr,
  durationStr,
}
