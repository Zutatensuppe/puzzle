import { Assets } from '../Assets'
import { Camera } from '../Camera'
import GameCommon from '../../../common/src/GameCommon'
import { EncodedPlayer, EncodedPlayerIdx, GameId, Timestamp } from '../../../common/src/Types'
import m4 from './m4'
import { Shader } from './Shader'
import playersFragment from './shaders/playersFragment'
import playersVertex from './shaders/playersVertex'
import { COLOR_BLUE, hexToColor } from '../../../common/src/Color'

type PlayerNameCacheEntry = {
  text: string
  canvas: HTMLCanvasElement
  fontHeight: number
  actualHeight: number
}
const playerNameCache: Record<string, PlayerNameCacheEntry> = {}

export class PlayersShaderWrapper {
  private shader!: Shader
  private positionLocation!: GLint
  private texcoordLocation!: GLint
  private positionBuffer!: WebGLBuffer
  private texcoordBuffer!: WebGLBuffer

  private textureInfoHand!: any
  private textureInfoGrab!: any

  private texName!: WebGLTexture

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly assets: Assets,
    private readonly gameId: GameId,
  ) {
  }

  public init() {
    this.shader = new Shader(this.gl, playersVertex, playersFragment)
    this.shader.bind()

    // look up where the vertex data needs to go.
    this.positionLocation = this.gl.getAttribLocation(this.shader.program, 'a_position')
    this.texcoordLocation = this.gl.getAttribLocation(this.shader.program, 'a_texcoord')

    // Create a buffer.
    this.positionBuffer = this.gl.createBuffer()!
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer)

    // Put a unit quad in the buffer
    const positions = [0, 0, 0, 1, 1, 0, 1, 0, 0, 1, 1, 1]
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.STATIC_DRAW)

    // Create a buffer for texture coords
    this.texcoordBuffer = this.gl.createBuffer()!
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texcoordBuffer)

    // Put texcoords in the buffer
    const texcoords = [0, 0, 0, 1, 1, 0, 1, 0, 0, 1, 1, 1]
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(texcoords), this.gl.STATIC_DRAW)

    // LOAD TEXTURE INFO
    const texHand = this.gl.createTexture()
    this.gl.bindTexture(this.gl.TEXTURE_2D, texHand)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR)
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.assets.Gfx.HAND_RAW)
    this.textureInfoHand = { width: this.assets.Gfx.HAND_RAW.width, height: this.assets.Gfx.HAND_RAW.height, texture: texHand }

    const texGrab = this.gl.createTexture()
    this.gl.bindTexture(this.gl.TEXTURE_2D, texGrab)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR)
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.assets.Gfx.GRAB_RAW)
    this.textureInfoGrab = { width: this.assets.Gfx.GRAB_RAW.width, height: this.assets.Gfx.GRAB_RAW.height, texture: texGrab }

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

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texcoordBuffer)
    this.gl.enableVertexAttribArray(this.texcoordLocation)
    this.gl.vertexAttribPointer(this.texcoordLocation, 2, this.gl.FLOAT, false, 0, 0)

    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6)
    this.gl.disableVertexAttribArray(this.positionLocation)
    this.gl.disableVertexAttribArray(this.texcoordLocation)
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
      const nameWidth = 200
      const nameHeight = 20
      const cacheEntry = this.getPlayerNameCanvas(p, nameWidth, nameHeight)
      if (cacheEntry) {
        this.drawPlayer(
          this.texName,
          nameWidth,
          nameHeight,
          pos.x - (nameWidth / 2),
          pos.y + 16 - (nameHeight - cacheEntry.fontHeight),
          p[EncodedPlayerIdx.COLOR],
          cacheEntry.canvas,
        )
      }
    }
  }

  private getPlayerNameCanvas(p: EncodedPlayer, w: number, h: number): PlayerNameCacheEntry | null {
    if (!p[EncodedPlayerIdx.NAME]) {
      return null
    }
    const text = `${p[EncodedPlayerIdx.NAME]} (${p[EncodedPlayerIdx.POINTS]})`
    if (!playerNameCache[p[EncodedPlayerIdx.ID]] || playerNameCache[p[EncodedPlayerIdx.ID]].text !== text) {
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = 'white'
      ctx.textAlign = 'center'
      ctx.fillText(text, canvas.width / 2, canvas.height / 2)
      const metrics = ctx.measureText(text)
      const fontHeight = metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent
      const actualHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent
      playerNameCache[p[EncodedPlayerIdx.ID]] = { text, canvas, fontHeight, actualHeight }
    }
    return playerNameCache[p[EncodedPlayerIdx.ID]]
  }
}
