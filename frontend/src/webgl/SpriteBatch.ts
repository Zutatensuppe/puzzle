import { AttributeSet, floatAttrib, ubyteAttrib, vec2Attrib } from './AttributeSet'
import { Buffer, Float32, Uint8 } from './Buffer'
import { TextureAtlas } from './TextureAtlas'


export type SpriteInfo = {
  texture: string
  // world pos
  x: number
  y: number
  // texture pos
  t_x: number
  t_y: number
  //
  rotation: number
}

// Anchor is top-left
// prettier-ignore
const QUAD = new Float32Array([
  // X, Y, U, V
  -0.5, -0.5, 0, 0,
  0.5, -0.5, 1, 0,
  0.5, 0.5, 1, 1,
  -0.5, -0.5, 0, 0,
  0.5, 0.5, 1, 1,
  -0.5, 0.5, 0, 1,
])

/**
 * A batch of sprites to be rendered.
 *
 * We use instanced rendering to render all sprites in a single draw call.
 *
 * Each sprite is rendered as a quad, with a per-instance texture ID and position.
 */
export class SpriteBatch {
  gl: WebGL2RenderingContext

  instances: number

  // The base quad
  quad: Buffer<Float32>

  // Per-instance texture ID
  tid: Buffer<Uint8>

  // Per-instance 2D position
  x: Buffer<Float32>
  y: Buffer<Float32>

  t_x: Buffer<Float32>
  t_y: Buffer<Float32>

  // Per-instance Rotation
  rotation: Buffer<Uint8>

  // Attribute set, used to bind the above buffers to the shader.
  attribs: AttributeSet

  constructor(
    gl: WebGL2RenderingContext,
    sprites: SpriteInfo[],
    spriteSize: number,
    atlas: TextureAtlas,
  ) {
    this.gl = gl

    const tid = new Uint8Array(sprites.map((s) => atlas.getId(s.texture)!))
    const x = new Float32Array(sprites.map((s) => s.x + spriteSize / 2))
    const y = new Float32Array(sprites.map((s) => s.y + spriteSize / 2))
    const t_x = new Float32Array(sprites.map((s) => s.t_x))
    const t_y = new Float32Array(sprites.map((s) => s.t_y))
    const rotation = new Uint8Array(sprites.map((s) => s.rotation))
    this.instances = sprites.length
    this.quad = new Buffer(gl, QUAD, 'static')
    this.tid = new Buffer(gl, tid, 'dynamic')
    this.t_x = new Buffer(gl, t_x, 'static')
    this.t_y = new Buffer(gl, t_y, 'static')
    this.x = new Buffer(gl, x, 'dynamic')
    this.y = new Buffer(gl, y, 'dynamic')
    this.rotation = new Buffer(gl, rotation, 'dynamic')

    this.attribs = new AttributeSet(gl, [
      {
        buffer: this.quad, // position, texcoord
        attributes: [vec2Attrib(0), vec2Attrib(1)],
      },
      {
        buffer: this.tid,
        attributes: [ubyteAttrib(2, 1)],
      },
      {
        buffer: this.x,
        attributes: [floatAttrib(3, 1)],
      },
      {
        buffer: this.y,
        attributes: [floatAttrib(4, 1)],
      },
      {
        buffer: this.t_x,
        attributes: [floatAttrib(5, 1)],
      },
      {
        buffer: this.t_y,
        attributes: [floatAttrib(6, 1)],
      },
      {
        buffer: this.rotation,
        attributes: [ubyteAttrib(7, 1)],
      },
    ])
  }

  draw() {
    this.x.flush()
    this.y.flush()
    this.t_x.flush()
    this.t_y.flush()
    this.tid.flush()
    this.rotation.flush()

    this.attribs.bind()
    this.gl.drawArraysInstanced(this.gl.TRIANGLES, 0, 6, this.instances)
  }

  destroy() {
    this.quad.destroy()
    this.tid.destroy()
    this.x.destroy()
    this.y.destroy()
    this.t_x.destroy()
    this.t_y.destroy()
    this.attribs.destroy()
    this.rotation.destroy()
  }
}
