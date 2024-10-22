export type Options = {
  minVx: number
  deltaVx: number
  minVy: number
  deltaVy: number

  minParticleV: number
  deltaParticleV: number

  gravity: number

  explosionRadius: number
  bombRadius: number
  explodingDuration: number
  explosionDividerFactor: number

  nBombs: number
  percentChanceNewBomb: number
}

export const defaultOptions = (): Options => ({
  minVx: -10,
  deltaVx: 20,
  minVy: 2,
  deltaVy: 15,

  minParticleV: 5,
  deltaParticleV: 5,

  gravity: 1,

  explosionRadius: 200,
  bombRadius: 10,
  explodingDuration: 100,
  explosionDividerFactor: 10,

  nBombs: 1,
  percentChanceNewBomb: 5,
})
