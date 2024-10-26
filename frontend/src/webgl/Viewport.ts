import m4 from './m4'

// keeps track of canvas size and produces a projection matrix
export class Viewport {
  private canvas: HTMLCanvasElement

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
  }

  get width() {
    return this.canvas.width
  }

  get height() {
    return this.canvas.height
  }

  resize(canvas: HTMLCanvasElement) {
    canvas.width = canvas.clientWidth
    canvas.height = canvas.clientHeight
  }

  projection() {
    return m4.orthographic(0, this.canvas.width, this.canvas.height, 0, -1, 1, undefined)
  }
}
