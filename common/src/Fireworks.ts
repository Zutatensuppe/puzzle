import { Controller as FireworksController } from './Fireworks/Controller'
import type { Rng } from './Rng'
import type { FireworksInterface } from './Types'

class Controller implements FireworksInterface {
  controller: FireworksController
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D

  public resizeBound: () => void

  constructor(canvas: HTMLCanvasElement, rng: Rng) {
    this.canvas = canvas
    this.ctx = this.canvas.getContext('2d')!
    this.resizeBound = this.resize.bind(this)

    this.controller = new FireworksController(rng)
  }

  private resize(): void {
    this.controller.updateSizeParams(this.canvas)
  }

  init(): void {
    this.controller.init()
  }

  update(): void {
    this.controller.doTick()
    this.controller.update()
  }

  render(): void {
    this.ctx.save()
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.1)' // Ghostly effect
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    this.ctx.restore()

    this.controller.render(this.ctx)
  }
}

export default Controller
