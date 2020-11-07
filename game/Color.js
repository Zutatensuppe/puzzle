export function tint(c, f) {
  return [
    Math.max(0, Math.min(255, Math.round((255 - c[0]) * f))),
    Math.max(0, Math.min(255, Math.round((255 - c[1]) * f))),
    Math.max(0, Math.min(255, Math.round((255 - c[2]) * f))),
    c[3]
  ]
}

export function shade(c, f) {
  return [
    Math.max(0, Math.min(255, Math.round(c[0] * f))),
    Math.max(0, Math.min(255, Math.round(c[1] * f))),
    Math.max(0, Math.min(255, Math.round(c[2] * f))),
    c[3]
  ]
}

export default {
  tint,
  shade
}
