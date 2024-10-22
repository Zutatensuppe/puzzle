export type Int8 = Int8Array
export type Uint8 = Uint8Array
export type Int16 = Int16Array
export type Uint16 = Uint16Array
export type Int32 = Int32Array
export type Uint32 = Uint32Array
export type Float32 = Float32Array
export type Float64 = Float64Array

export type BufferType = Int8 | Uint8 | Int16 | Uint16 | Int32 | Uint32 | Float32 | Float64

/**
 * A simple wrapper around a WebGL buffer, which stores the data
 * both CPU-side and GPU-side, with the ability to update the data
 * on the CPU and synchronize it with the GPU.
 */
export class Buffer<Data extends BufferType> {
  private gl: WebGL2RenderingContext
  private buffer: WebGLBuffer
  private data: Data

  /**
   *
   * The `mode` parameter is used to determine how the buffer will be used:
   * - `static` is for data which does not change.
   * - `dynamic` is for data which changes frequently.
   *
   * `static` does not mean the data is immutable, it just means that the data
   * is not expected to change frequently, and updating it frequently may result
   * in worse performance.
   *
   * `dynamic` means that the data is expected to change frequently, and the buffer
   * will be optimized for frequent updates.
   *
   * In practice, modern GPUs are very good at handling dynamic data, so the
   * `mode` argument does not have a huge impact on performance.
   */
  constructor(gl: WebGL2RenderingContext, data: Data, mode: 'static' | 'dynamic') {
    this.gl = gl
    this.buffer = gl.createBuffer()!
    this.data = data

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
    gl.bufferData(gl.ARRAY_BUFFER, data, mode === 'static' ? gl.STATIC_DRAW : gl.DYNAMIC_DRAW)
  }

  private dirty = false

  get(offset: number) {
    return this.data[offset]
  }

  /**
   * Update the data on the CPU-side.
   *
   * `flush` must be called at some point before any draw calls
   * to synchronize the data with the GPU.
   */
  set(offset: number, value: number) {
    this.data[offset] = value
    this.dirty = true
  }

  bind() {
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer)
  }

  unbind() {
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null)
  }

  /**
   * Synchronize the CPU-side data with the GPU.
   */
  flush() {
    if (!this.dirty) {
      return
    }

    this.bind()
    this.gl.bufferData(this.gl.ARRAY_BUFFER, this.data, this.gl.DYNAMIC_DRAW)
  }

  destroy() {
    this.gl.deleteBuffer(this.buffer)
    this.data = null!
  }
}
