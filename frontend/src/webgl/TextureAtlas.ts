export class TextureAtlas {
  private gl: WebGL2RenderingContext
  private nameToId: Record<number, number>
  // Note: you can awlays bind a texture directly, but it's also possible
  //       to use a sampler to change how a texture is handled by the GPU
  //       without creating a new texture.
  private texture: WebGLTexture

  constructor(gl: WebGL2RenderingContext, images: [number, ImageBitmap][]) {
    if (images.length === 0) {
      throw new Error('Cannot create texture atlas: no images provided')
    }
    gl.enable(gl.SAMPLE_ALPHA_TO_COVERAGE)
    gl.enable(gl.BLEND)
    // check that all images have the same dimensions
    const firstImage = images[0][1]
    const errors = []
    for (let i = 1; i < images.length; i++) {
      const [src, image] = images[i]
      if (image.width !== firstImage.width || image.height !== firstImage.height) {
        errors.push(`${src} has different dimensions`)
      }
    }
    if (errors.length > 0) {
      throw new Error(`Cannot create texture atlas:\n${errors.join(', ')}`)
    }

    this.gl = gl
    this.nameToId = {}
    this.texture = gl.createTexture()!

    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.texture)

    // prettier-ignore
    gl.texStorage3D(
      gl.TEXTURE_2D_ARRAY, 1, gl.RGBA8,
      images[0][1].width, images[0][1].height, images.length,
    )

    for (let i = 0; i < images.length; i++) {
      const [src, image] = images[i]
      // prettier-ignore
      gl.texSubImage3D(
        gl.TEXTURE_2D_ARRAY, 0,
        0, 0, i,
        image.width, image.height, 1,
        gl.RGBA, gl.UNSIGNED_BYTE,
        image,
      )

      this.nameToId[src] = i
    }

    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    gl.bindTexture(gl.TEXTURE_2D_ARRAY, null)
  }

  getId(name: number) {
    const id = this.nameToId[name]
    if (id === undefined) {
      throw new Error(`Cannot find texture ${name}`)
    }
    return id
  }

  private index: number = -1
  bind(index: number) {
    this.index = index
    this.gl.activeTexture(this.gl.TEXTURE0 + index)
    this.gl.bindTexture(this.gl.TEXTURE_2D_ARRAY, this.texture)
  }

  unbind() {
    this.gl.activeTexture(this.gl.TEXTURE0 + this.index)
    this.gl.bindTexture(this.gl.TEXTURE_2D_ARRAY, null)
  }

  destroy() {
    this.gl.deleteTexture(this.texture)
    this.nameToId = {}
    this.index = -1
  }
}
