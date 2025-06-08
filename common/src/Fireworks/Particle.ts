import type { Bomb } from './Bomb'

export class Particle {
  public px!: number
  public py!: number
  public vx!: number
  public vy!: number
  public duration!: number
  public alive!: boolean
  public radius!: number
  public parent: Bomb

  constructor(parent: Bomb, angle: number, speed: number) {
    this.parent = parent
    this.px = parent.px
    this.py = parent.py
    this.vx = Math.cos(angle) * speed
    this.vy = Math.sin(angle) * speed
    this.duration = this.parent.controller.rng.random(120, 140)
    this.alive = true
    this.radius = 0
  }

  update() {
    this.vx += 0
    this.vy += this.parent.controller.options.gravity / 10

    this.px += this.vx
    this.py += this.vy
    this.radius = 3

    this.duration--
    if (this.duration <= 0) {
      this.alive = false
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(this.px, this.py, this.radius, 0, Math.PI * 2, false)
    ctx.fillStyle = this.parent.colorHex
    ctx.lineWidth = 1
    ctx.fill()
    ctx.restore()
  }

  getWebglArray(): number[] {
    return [
      this.px, this.py, this.parent.colorHue, this.radius,
    ]
  }
}
