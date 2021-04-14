const MS = 1
const SEC = MS * 1000
const MIN = SEC * 60
const HOUR = MIN * 60
const DAY = HOUR * 24

export const timestamp = () => {
  const d = new Date();
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

export const timeDiffStr = (from, to) => {
  let diff = to - from
  const d = Math.floor(diff / DAY)
  diff = diff % DAY

  const h = Math.floor(diff / HOUR)
  diff = diff % HOUR

  const m = Math.floor(diff / MIN)
  diff = diff % MIN

  const s = Math.floor(diff / SEC)

  return `${d}d ${h}h ${m}m ${s}s`
}

export default {
  MS,
  SEC,
  MIN,
  HOUR,
  DAY,

  timestamp,
  timeDiffStr,
}
