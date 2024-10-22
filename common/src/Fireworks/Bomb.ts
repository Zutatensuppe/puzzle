import { randomColor, rgbToHue, rgbToRgba } from '../Color'
import { Controller } from './Controller'
import { Particle } from './Particle'

export class Bomb {
  radius: number
  previousRadius: number
  explodingDuration: number
  hasExploded: boolean
  alive: boolean
  px: number
  py: number
  vx: number
  vy: number
  duration: number

  colorHue: number
  colorHex: string

  constructor(
    public readonly controller: Controller,
  ) {
    this.radius = controller.options.bombRadius
    this.previousRadius = controller.options.bombRadius
    this.explodingDuration = controller.options.explodingDuration
    this.hasExploded = false
    this.alive = true

    const c = randomColor(controller.rng)
    this.colorHue = rgbToHue(...c)
    this.colorHex = rgbToRgba(...c, .8)

    this.px = (window.innerWidth / 4) + (this.controller.rng.random(0, window.innerWidth) / 2)
    this.py = window.innerHeight

    this.vx = controller.options.minVx + this.controller.rng.random(0, controller.options.deltaVx)
    this.vy = (controller.options.minVy + this.controller.rng.random(0, controller.options.deltaVy)) * -1

    this.duration = 0
  }

  public update(particlesVector?: Particle[]) {
    if (this.hasExploded) {
      const deltaRadius = this.controller.options.explosionRadius - this.radius
      this.previousRadius = this.radius
      this.radius += deltaRadius / this.controller.options.explosionDividerFactor
      this.explodingDuration--
      if (this.explodingDuration == 0) {
        this.alive = false
      }
    } else {
      this.vx += 0
      this.vy += this.controller.options.gravity
      if (this.vy >= 0) { // invertion point
        if (particlesVector) {
          this.explode(particlesVector)
        }
      }

      this.px += this.vx
      this.py += this.vy
    }
  }

  public explode(particlesVector: Particle[]) {
    this.hasExploded = true
    const e = this.controller.rng.random(3, 5)
    for (let j = 0; j < e; j++) {
      const n = this.controller.rng.random(10, 30)
      const speed = this.controller.options.minParticleV + this.controller.rng.random(0, this.controller.options.deltaParticleV)
      const deltaAngle = (2 * Math.PI / n) * 100.0
      const initialAngle = this.controller.rng.random(0, deltaAngle) / 100.0
      for (let i = 0; i < n; i++) {
        particlesVector.push(new Particle(this, i * deltaAngle + initialAngle, speed))
      }
    }
  }

  public draw(ctx: CanvasRenderingContext2D) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(this.px, this.py, this.previousRadius, 0, Math.PI * 2, false)
    ctx.fillStyle = this.colorHex
    ctx.lineWidth = 1
    ctx.fill()
    ctx.restore()
  }

  public getWebglArray(): number[] {
    return [
      this.px, this.py, this.colorHue, this.radius,
    ]
  }
}
