'use strict'

import { GraphicsOperations } from './GraphicsOperations'
import { GraphicsLoader } from './GraphicsLoader'

export class Graphics {
  private static instance: Graphics

  public readonly loader: GraphicsLoader
  public readonly op: GraphicsOperations

  private supportsWebgl2Cache: boolean | null = null

  private constructor() {
    this.loader = new GraphicsLoader(this)
    this.op = new GraphicsOperations(this)
  }

  public static getInstance(): Graphics {
    if (!Graphics.instance) {
      Graphics.instance = new Graphics()
    }
    return Graphics.instance
  }

  public hasWebGL2Support(): boolean {
    if (this.supportsWebgl2Cache === null) {
      const canvas = this.createCanvas(1, 1)
      this.supportsWebgl2Cache = !!canvas.getContext('webgl2')
    }
    return this.supportsWebgl2Cache
  }

  public createCanvas(width: number, height: number = width): HTMLCanvasElement {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    return canvas
  }
}
