import type { Assets } from '../Assets'
import type { Camera } from '../Camera'
import GameCommon from '../../../common/src/GameCommon'
import { EncodedPlayerIdx } from '../../../common/src/Types'
import type { EncodedPlayer, GameId, Timestamp } from '../../../common/src/Types'
import m4 from './m4'
import { Shader } from './Shader'
import playersFragment from './shaders/playersFragment'
import playersVertex from './shaders/playersVertex'
import { COLOR_BLUE, hexToColor } from '../../../common/src/Color'
import type { Graphics } from '../Graphics'
import { getPlayerNameCanvas } from '../PlayerNames'
import { GraphicsEnum } from '../../../common/src/Constants'

export class PlayersShaderWrapper {
  private shader!: Shader
  private positionLocation!: GLint
  private texCoordLocation!: GLint
  private positionBuffer!: WebGLBuffer
  private texCoordBuffer!: WebGLBuffer

  private textureInfoHand!: { width: number, height: number, texture: WebGLTexture }
  private textureInfoGrab!: { width: number, height: number, texture: WebGLTexture }

  private texName!: WebGLTexture

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly assets: Assets,
    private readonly gameId: GameId,
    private readonly graphics: Graphics,
  ) {
  }

  public init() {
    this.shader = new Shader(this.gl, playersVertex, playersFragment)
    this.shader.bind()

    // look up where the vertex data needs to go.
    this.positionLocation = this.gl.getAttribLocation(this.shader.program, 'a_position')
    this.texCoordLocation = this.gl.getAttribLocation(this.shader.program, 'a_texCoord')

    // Create a buffer.
    this.positionBuffer = this.gl.createBuffer()!
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer)

    // Put a unit quad in the buffer
    const positions = [0, 0, 0, 1, 1, 0, 1, 0, 0, 1, 1, 1]
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.STATIC_DRAW)

    // Create a buffer for texture coords
    this.texCoordBuffer = this.gl.createBuffer()!
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer)

    // Put texCoords in the buffer
    const texCoords = [0, 0, 0, 1, 1, 0, 1, 0, 0, 1, 1, 1]
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(texCoords), this.gl.STATIC_DRAW)

    // LOAD TEXTURE INFO
    const texHand = this.gl.createTexture()!
    this.gl.bindTexture(this.gl.TEXTURE_2D, texHand)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR)
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.assets.Gfx[GraphicsEnum.CURSOR_HAND_RAW])
    this.textureInfoHand = { width: this.assets.Gfx[GraphicsEnum.CURSOR_HAND_RAW].width, height: this.assets.Gfx[GraphicsEnum.CURSOR_HAND_RAW].height, texture: texHand }

    const texGrab = this.gl.createTexture()!
    this.gl.bindTexture(this.gl.TEXTURE_2D, texGrab)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR)
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.assets.Gfx[GraphicsEnum.CURSOR_GRAB_RAW])
    this.textureInfoGrab = { width: this.assets.Gfx[GraphicsEnum.CURSOR_GRAB_RAW].width, height: this.assets.Gfx[GraphicsEnum.CURSOR_GRAB_RAW].height, texture: texGrab }

    this.texName = this.gl.createTexture()!
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texName)
    // Fill the texture with a 1x1 blue pixel.
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, 1, 1, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, COLOR_BLUE)
    // let's assume all images are not a power of 2
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR)
  }

  private drawPlayer(
    tex: WebGLTexture,
    texWidth: number,
    texHeight: number,
    dstX: number,
    dstY: number,
    color: string | null,
    nameCanvas: HTMLCanvasElement | null,
  ) {
    this.gl.bindTexture(this.gl.TEXTURE_2D, tex)
    if (nameCanvas) {
      this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, nameCanvas)
    }

    this.shader.bind()

    this.shader.setUniform('u_isUkraine', color === 'ukraine' ? 1 : 0)
    this.shader.setUniform('u_color', hexToColor(color || '') as number[])
    this.shader.setUniform('u_matrix', this.createMatrix(dstX, dstY, texWidth, texHeight))
    this.shader.setUniform('u_texture', 1)

    // Setup the attributes to pull data from our buffers
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer)
    this.gl.enableVertexAttribArray(this.positionLocation)
    this.gl.vertexAttribPointer(this.positionLocation, 2, this.gl.FLOAT, false, 0, 0)

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer)
    this.gl.enableVertexAttribArray(this.texCoordLocation)
    this.gl.vertexAttribPointer(this.texCoordLocation, 2, this.gl.FLOAT, false, 0, 0)

    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6)
    this.gl.disableVertexAttribArray(this.positionLocation)
    this.gl.disableVertexAttribArray(this.texCoordLocation)
  }

  private createMatrix(translateX: number, translateY: number, scaleW: number, scaleH: number) {
    let matrix = m4.orthographic(0, this.gl.canvas.width, this.gl.canvas.height, 0, -1, 1, undefined)
    matrix = m4.translate(matrix, translateX, translateY, 0, undefined)
    matrix = m4.scale(matrix, scaleW, scaleH, 1, undefined)
    return matrix
  }

  public render(
    viewport: Camera,
    shouldDrawPlayer: (player: EncodedPlayer) => boolean,
    showPlayerNames: boolean,
    ts: Timestamp,
  ) {
    this.shader.bind()
    const players = GameCommon.getActivePlayers(this.gameId, ts)
    for (const p of players) {
      if (!shouldDrawPlayer(p)) {
        continue
      }
      const pos = viewport.worldToViewportXy(p[EncodedPlayerIdx.X], p[EncodedPlayerIdx.Y])
      const textureInfo = p[EncodedPlayerIdx.MOUSEDOWN] ? this.textureInfoGrab : this.textureInfoHand
      this.drawPlayer(
        textureInfo.texture,
        textureInfo.width,
        textureInfo.height,
        pos.x - 8,
        pos.y - 8,
        p[EncodedPlayerIdx.COLOR],
        null,
      )
      if (!showPlayerNames) {
        continue
      }
      const cacheEntry = getPlayerNameCanvas(this.graphics, p)
      if (cacheEntry) {
        this.drawPlayer(
          this.texName,
          cacheEntry.canvas.width,
          cacheEntry.canvas.height,
          pos.x - (cacheEntry.canvas.width / 2),
          pos.y + 16 - (cacheEntry.canvas.height - cacheEntry.fontHeight),
          p[EncodedPlayerIdx.COLOR],
          cacheEntry.canvas,
        )
      }
    }
  }
}
