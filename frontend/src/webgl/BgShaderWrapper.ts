import { Shader } from './Shader'
import bgVertex from './shaders/bgVertex'
import bgFragment from './shaders/bgFragment'
import m4 from './m4'
import type { Dim, Point, Rect } from '../Geometry'
import type { PuzzleTableTextureInfo } from '../PuzzleTableTextureInfo'
import type { Graphics } from '../Graphics'
import { hexToColor } from '../../../common/src/Color'
import type { Color } from '../../../common/src/Color'

type TextureInfo = {
  texture: WebGLTexture
  width: number
  height: number
  isDark: boolean
}

export class BgShaderWrapper {
  private shader!: Shader
  private textureInfo: TextureInfo | null = null

  private vao!: WebGLVertexArrayObject

  private previewTex!: WebGLTexture

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly graphics: Graphics,
  ) {
  }

  public init(tableBounds: Rect, boardDim: Dim, boardPos: Point, puzzleBitmap: HTMLCanvasElement) {
    this.shader = new Shader(this.gl, bgVertex, bgFragment)
    this.shader.bind()

    this.vao = this.gl.createVertexArray()!
    this.gl.bindVertexArray(this.vao)

    const positionBuffer = this.gl.createBuffer()
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer)
    const positions = [0, 0, 0, 1, 1, 0, 1, 0, 0, 1, 1, 1]
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.STATIC_DRAW)
    const positionAttributeLocation = this.gl.getAttribLocation(this.shader.program, 'a_position')
    this.gl.enableVertexAttribArray(positionAttributeLocation)
    this.gl.vertexAttribPointer(positionAttributeLocation, 2, this.gl.FLOAT, false, 0, 0)

    const tH = tableBounds.h
    const tW = tableBounds.w
    const texcoordBuffer = this.gl.createBuffer()!
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, texcoordBuffer)
    const texcoords = [0, 0, 0, tH, tW, 0, tW, 0, 0, tH, tW, tH]
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(texcoords), this.gl.STATIC_DRAW)
    const texcoordAttributeLocation = this.gl.getAttribLocation(this.shader.program, 'a_texCoord')
    this.gl.enableVertexAttribArray(texcoordAttributeLocation)
    this.gl.vertexAttribPointer(texcoordAttributeLocation, 2, this.gl.FLOAT, true, 0, 0)

    const outerBorderSize = 16
    this.shader.setUniform('u_innerRect', [
      outerBorderSize,
      outerBorderSize,
      (tableBounds.w - outerBorderSize),
      (tableBounds.h - outerBorderSize),
    ])
    const puzzleFinalBorderSize = 8
    this.shader.setUniform('u_puzzleFinalRectBorder', [
      boardPos.x - puzzleFinalBorderSize,
      boardPos.y - puzzleFinalBorderSize,
      boardPos.x + boardDim.w + puzzleFinalBorderSize,
      boardPos.y + boardDim.h + puzzleFinalBorderSize,
    ])
    this.shader.setUniform('u_puzzleFinalRect', [
      boardPos.x,
      boardPos.y,
      boardPos.x + boardDim.w,
      boardPos.y + boardDim.h,
    ])
    this.shader.setUniform('u_previewDim', [boardDim.w, boardDim.h])

    this.previewTex = this.gl.createTexture()!
    this.gl.activeTexture(this.gl.TEXTURE1)
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.previewTex)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR)
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, puzzleBitmap)
  }

  public loadTexture(tableTextureInfo: PuzzleTableTextureInfo): Promise<void> {
    return new Promise<void>((resolve) => {
      const img = new Image()
      img.addEventListener('load', () => {
        const texture = this.gl.createTexture()!
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture)
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.REPEAT)
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.REPEAT)
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, img)
        this.gl.generateMipmap(this.gl.TEXTURE_2D)
        this.textureInfo = {
          texture,
          width: img.width * tableTextureInfo.scale,
          height: img.height * tableTextureInfo.scale,
          isDark: this.graphics.isDark(img),
        }
        resolve()
      })
      img.src = tableTextureInfo.url.match(/^https?:\/\//)
        ? `/api/proxy?${new URLSearchParams({ url: tableTextureInfo.url })}`
        : tableTextureInfo.url
    })
  }


  private drawBackground(
    showTable: boolean,
    showPreview: boolean,
    color: Color,
    dim: Dim,
    pos: Point,
  ) {
    this.gl.clearColor(color[0], color[1], color[2], 1)
    this.gl.clear(this.gl.COLOR_BUFFER_BIT)

    this.shader.bind()

    this.gl.bindVertexArray(this.vao)

    if (showTable && this.textureInfo) {
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.textureInfo.texture)
      this.shader.setUniform('u_texScale', [this.textureInfo.width, this.textureInfo.height])
      this.shader.setUniform('u_isDark', this.textureInfo.isDark ? 1 : 0)
      this.shader.setUniform('u_showTable', 1)
    } else {
      this.shader.setUniform('u_showTable', 0)
    }
    this.shader.setUniform('u_color', color as number[])
    this.shader.setUniform('u_showPreview', showPreview ? 1 : 0)
    this.shader.setUniform('u_matrix', this.createMatrix(pos.x, pos.y, dim.w, dim.h))
    this.shader.setUniform('u_texture0', 0)
    this.shader.setUniform('u_texture1', 1)

    this.gl.activeTexture(this.gl.TEXTURE0)
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.textureInfo!.texture)

    this.gl.activeTexture(this.gl.TEXTURE1)
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.previewTex)

    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6)
  }

  private createMatrix(translateX: number, translateY: number, scaleW: number, scaleH: number) {
    let matrix = m4.orthographic(0, this.gl.canvas.width, this.gl.canvas.height, 0, -1, 1, undefined)
    matrix = m4.translate(matrix, translateX, translateY, 0, undefined)
    matrix = m4.scale(matrix, scaleW, scaleH, 1, undefined)
    return matrix
  }

  public render(
    showTable: boolean,
    showPreview: boolean,
    colorStr: string,
    dim: Dim,
    pos: Point,
  ) {
    this.drawBackground(showTable, showPreview, hexToColor(colorStr), dim, pos)
  }
}
