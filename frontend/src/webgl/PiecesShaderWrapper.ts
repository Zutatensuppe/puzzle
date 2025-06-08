import { Camera } from '../Camera'
import GameCommon from '../../../common/src/GameCommon'
import Util from '../../../common/src/Util'
import { EncodedPieceIdx, PieceRotation } from '../../../common/src/Types'
import type { EncodedPiece, EncodedPieceShape, GameId } from '../../../common/src/Types'
import { Shader } from './Shader'
import piecesFragment from './shaders/piecesFragment'
import piecesVertex from './shaders/piecesVertex'
import { SpriteBatch, PieceSpriteInfo } from './SpriteBatch'
import { TextureAtlas } from './TextureAtlas'
import m4 from './m4'

export class PiecesShaderWrapper {
  private shader!: Shader
  private atlas!: TextureAtlas
  private bgTex!: WebGLTexture
  private sprites!: SpriteBatch

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly gameId: GameId,
  ) {
  }

  public init(puzzleBitmap: HTMLCanvasElement, stencils: Record<EncodedPieceShape, ImageBitmap>) {
    console.time('textureAtlas')
    this.atlas = new TextureAtlas(this.gl, Object.keys(stencils).map((key) => [key as unknown as EncodedPieceShape, stencils[key as unknown as EncodedPieceShape]]))
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

    const info = GameCommon.getPuzzle(this.gameId).info
    this.shader.bind()
    this.shader.setUniform('puzzle_image_size', [info.width, info.height])
    const sprites: PieceSpriteInfo[] = []
    const maxZ = GameCommon.getMaxZIndex(this.gameId)
    for (const piece of GameCommon.getEncodedPieces(this.gameId)) {
      const finalPos = GameCommon.getSrcPosByPieceIdx(this.gameId, piece[EncodedPieceIdx.IDX])
      sprites.push({
        x: piece[EncodedPieceIdx.POS_X],
        y: piece[EncodedPieceIdx.POS_Y],
        z: (maxZ ? piece[EncodedPieceIdx.Z] / maxZ : 0) - 0.5,
        puzzleImageX: finalPos.x,
        puzzleImageY: finalPos.y,
        stencilTexture: this.pieceTexture(info.shapes, piece),
        rotation: this.pieceRotation(piece[EncodedPieceIdx.ROTATION]),
        visible: true,
      })
    }
    //
    const spriteSize = 128
    const borderSize = spriteSize / 4
    this.sprites = new SpriteBatch(this.gl, sprites, spriteSize + borderSize, this.atlas)
    console.timeEnd('rest')
  }

  private pieceRotation(rot: PieceRotation | undefined): number {
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

  private pieceTexture(shapes: EncodedPieceShape[], piece: EncodedPiece): EncodedPieceShape {
    return Util.rotateEncodedShape(shapes[piece[EncodedPieceIdx.IDX]], piece[EncodedPieceIdx.ROTATION])
  }

  public render(
    camera: Camera,
    shouldDrawEncodedPiece: (piece: EncodedPiece) => boolean,
  ) {
    // bind the shader and update the uniforms
    this.shader.bind()
    const info = GameCommon.getPuzzle(this.gameId).info
    let i = 0
    const maxZ = GameCommon.getMaxZIndex(this.gameId)
    for (const piece of GameCommon.getEncodedPieces(this.gameId)) {
      this.sprites.setX(i, piece[EncodedPieceIdx.POS_X])
      this.sprites.setY(i, piece[EncodedPieceIdx.POS_Y])
      this.sprites.z.set(i, ((maxZ ? piece[EncodedPieceIdx.Z] / maxZ : 0) - 0.5))
      this.sprites.setTexture(i, this.pieceTexture(info.shapes, piece))
      this.sprites.rotation.set(i, this.pieceRotation(piece[EncodedPieceIdx.ROTATION]))
      this.sprites.visible.set(i, shouldDrawEncodedPiece(piece) ? 1 : 0)
      i++
    }
    this.shader.setUniform('projection', m4.orthographic(0, this.gl.canvas.width, this.gl.canvas.height, 0, -1, 1, undefined))
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
