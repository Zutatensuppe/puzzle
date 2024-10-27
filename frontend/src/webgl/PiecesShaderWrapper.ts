import { Camera } from '../Camera'
import GameCommon from '../../../common/src/GameCommon'
import { PieceRotation } from '../../../common/src/Types'
import { EncodedPieceShape, GameId, Piece } from '../Types'
import { Shader } from './Shader'
import piecesFragment from './shaders/piecesFragment'
import piecesVertex from './shaders/piecesVertex'
import { SpriteBatch, SpriteInfo } from './SpriteBatch'
import { TextureAtlas } from './TextureAtlas'
import { Viewport } from './Viewport'

export class PiecesShaderWrapper {
  private shader!: Shader
  private atlas!: TextureAtlas
  private bgTex!: WebGLTexture
  private sprites!: SpriteBatch

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly viewport: Viewport,
    private readonly gameId: GameId,
  ) {
  }

  public init(puzzleBitmap: HTMLCanvasElement, stencils: Record<EncodedPieceShape, ImageBitmap>) {
    console.time('textureAtlas')
    this.atlas = new TextureAtlas(this.gl, Object.keys(stencils).map((key) => [`${key}`, stencils[key as unknown as EncodedPieceShape]]))
    console.timeEnd('textureAtlas')

    console.time('rest')
    this.bgTex = this.gl.createTexture()!
    this.gl.activeTexture(this.gl.TEXTURE1)
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.bgTex)
    // Set the parameters so we can render any size image.
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR)
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, puzzleBitmap)
    this.shader = new Shader(this.gl, piecesVertex, piecesFragment)
    console.timeEnd('rest')
  }

  private pieceRotationToDegrees(rot: PieceRotation | undefined): number {
    switch (rot) {
      case PieceRotation.R90:
        return 1
      case PieceRotation.R180:
        return 2
      case PieceRotation.R270:
        return 3
      case PieceRotation.R0:
      default:
        return 0
    }
  }

  public render(
    camera: Camera,
    shouldDrawPiece: (piece: Piece) => boolean,
  ) {
    const info = GameCommon.getPuzzle(this.gameId).info
    const spriteSize = 128
    const sprites: SpriteInfo[] = []
    GameCommon.getPiecesSortedByZIndex(this.gameId).forEach((piece) => {
      if (!shouldDrawPiece(piece)) {
        return
      }
      const finalPos = GameCommon.getSrcPosByPieceIdx(this.gameId, piece.idx)
      sprites.push({
        x: piece.pos.x,
        y: piece.pos.y,
        t_x: finalPos.x,
        t_y: finalPos.y,
        texture: `${info.shapes[piece.idx]}`,
        rotation: this.pieceRotationToDegrees(piece.rot),
      })
    })
    this.sprites = new SpriteBatch(this.gl, sprites, spriteSize, this.atlas)

    // bind the shader and update the uniforms
    this.shader.bind()
    this.shader.setUniform('projection', this.viewport.projection())
    this.shader.setUniform('puzzle_image_size', [info.width, info.height])
    this.shader.setUniform('view', [
      camera.curZoom, 0, 0, 0,
      0, camera.curZoom, 0, 0,
      0, 0, 1, 0,
      (camera.x + (2 * info.tileDrawOffset)) * camera.curZoom, (camera.y + (2 * info.tileDrawOffset)) * camera.curZoom, 0, 1,
    ])
    // bind the atlas to texture slot 0
    this.atlas.bind(0)
    this.shader.setUniform('atlas', 0)

    this.gl.activeTexture(this.gl.TEXTURE1)
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.bgTex)
    this.shader.setUniform('atlas2', 1)

    // draw the sprites
    this.sprites.draw()
  }
}
