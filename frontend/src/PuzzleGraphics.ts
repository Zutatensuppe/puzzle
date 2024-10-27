'use strict'

import Geometry, { Dim, Point, Rect } from '../../common/src/Geometry'
import Util, { logger } from '../../common/src/Util'
import { Color, COLOR_MAGENTA, colorEquals, colorIsGrayscale } from '../../common/src/Color'
import { Puzzle, PuzzleInfo, PieceShape, EncodedPiece, ShapeMode, EncodedPieceShape, EncodedPieceIdx } from '../../common/src/Types'
import { determinePuzzlePieceShapes, PuzzleCreationInfo } from '../../common/src/Puzzle'
import { Rng } from '../../common/src/Rng'
import { Graphics } from './Graphics'

const log = logger('PuzzleGraphics.js')

const CURVY_COORDS = [
  0, 0, 35, 15, 37, 5,
  37, 5, 40, 0, 38, -5,
  38, -5, 20, -20, 50, -20,
  50, -20, 80, -20, 62, -5,
  62, -5, 60, 0, 63, 5,
  63, 5, 65, 15, 100, 0,
]

function createPathForShape(shape: PieceShape, x: number, y: number, pieceSize: number) {
  const pieceRatio = pieceSize / 100.0
  const path = new Path2D()
  const topLeftEdge = { x, y }
  const topRightEdge = Geometry.pointAdd(topLeftEdge, { x: pieceSize, y: 0 })
  const bottomRightEdge = Geometry.pointAdd(topRightEdge, { x: 0, y: pieceSize })
  const bottomLeftEdge = Geometry.pointSub(bottomRightEdge, { x: pieceSize, y: 0 })

  path.moveTo(topLeftEdge.x, topLeftEdge.y)
  if (shape.top !== 0) {
    for (let i = 0; i < CURVY_COORDS.length / 6; i++) {
      const p1 = Geometry.pointAdd(topLeftEdge, { x: CURVY_COORDS[i * 6 + 0] * pieceRatio, y: shape.top * CURVY_COORDS[i * 6 + 1] * pieceRatio })
      const p2 = Geometry.pointAdd(topLeftEdge, { x: CURVY_COORDS[i * 6 + 2] * pieceRatio, y: shape.top * CURVY_COORDS[i * 6 + 3] * pieceRatio })
      const p3 = Geometry.pointAdd(topLeftEdge, { x: CURVY_COORDS[i * 6 + 4] * pieceRatio, y: shape.top * CURVY_COORDS[i * 6 + 5] * pieceRatio })
      path.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y)
    }
  } else {
    path.lineTo(topRightEdge.x, topRightEdge.y)
  }
  if (shape.right !== 0) {
    for (let i = 0; i < CURVY_COORDS.length / 6; i++) {
      const p1 = Geometry.pointAdd(topRightEdge, { x: -shape.right * CURVY_COORDS[i * 6 + 1] * pieceRatio, y: CURVY_COORDS[i * 6 + 0] * pieceRatio })
      const p2 = Geometry.pointAdd(topRightEdge, { x: -shape.right * CURVY_COORDS[i * 6 + 3] * pieceRatio, y: CURVY_COORDS[i * 6 + 2] * pieceRatio })
      const p3 = Geometry.pointAdd(topRightEdge, { x: -shape.right * CURVY_COORDS[i * 6 + 5] * pieceRatio, y: CURVY_COORDS[i * 6 + 4] * pieceRatio })
      path.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y)
    }
  } else {
    path.lineTo(bottomRightEdge.x, bottomRightEdge.y)
  }
  if (shape.bottom !== 0) {
    for (let i = 0; i < CURVY_COORDS.length / 6; i++) {
      const p1 = Geometry.pointSub(bottomRightEdge, { x: CURVY_COORDS[i * 6 + 0] * pieceRatio, y: shape.bottom * CURVY_COORDS[i * 6 + 1] * pieceRatio })
      const p2 = Geometry.pointSub(bottomRightEdge, { x: CURVY_COORDS[i * 6 + 2] * pieceRatio, y: shape.bottom * CURVY_COORDS[i * 6 + 3] * pieceRatio })
      const p3 = Geometry.pointSub(bottomRightEdge, { x: CURVY_COORDS[i * 6 + 4] * pieceRatio, y: shape.bottom * CURVY_COORDS[i * 6 + 5] * pieceRatio })
      path.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y)
    }
  } else {
    path.lineTo(bottomLeftEdge.x, bottomLeftEdge.y)
  }
  if (shape.left !== 0) {
    for (let i = 0; i < CURVY_COORDS.length / 6; i++) {
      const p1 = Geometry.pointSub(bottomLeftEdge, { x: -shape.left * CURVY_COORDS[i * 6 + 1] * pieceRatio, y: CURVY_COORDS[i * 6 + 0] * pieceRatio })
      const p2 = Geometry.pointSub(bottomLeftEdge, { x: -shape.left * CURVY_COORDS[i * 6 + 3] * pieceRatio, y: CURVY_COORDS[i * 6 + 2] * pieceRatio })
      const p3 = Geometry.pointSub(bottomLeftEdge, { x: -shape.left * CURVY_COORDS[i * 6 + 5] * pieceRatio, y: CURVY_COORDS[i * 6 + 4] * pieceRatio })
      path.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y)
    }
  } else {
    path.lineTo(topLeftEdge.x, topLeftEdge.y)
  }
  return path
}

export function drawPuzzlePreview(
  previewDim: Dim,
  previewPieceSize: number,
  puzzleCreationInfo: PuzzleCreationInfo,
  shapeMode: ShapeMode,
  ctx: CanvasRenderingContext2D,
  imageRect: Rect,
  off: Point,
): void {
  ctx.save()
  ctx.fillStyle = '#000'
  ctx.globalAlpha = .5
  ctx.fillRect(imageRect.x, imageRect.y, off.x, previewDim.h)
  ctx.fillRect(imageRect.x + previewDim.w + off.x, imageRect.y, imageRect.w - previewDim.w - off.x, previewDim.h)
  ctx.fillRect(imageRect.x, imageRect.y, previewDim.w, off.y)
  ctx.fillRect(imageRect.x, imageRect.y + previewDim.h + off.y, previewDim.w, imageRect.h - previewDim.h - off.y)
  ctx.restore()

  const shapes = determinePuzzlePieceShapes(new Rng(0), puzzleCreationInfo, shapeMode)
  ctx.save()
  ctx.fillStyle = '#000'
  ctx.lineWidth = .3
  ctx.globalAlpha = .7
  for (let y = 0; y < puzzleCreationInfo.pieceCountVertical; y++) {
    for (let x = 0; x < puzzleCreationInfo.pieceCountHorizontal; x++) {
      const path = createPathForShape(
        Util.decodeShape(shapes.shift() as number),
        imageRect.x + off.x + x * previewPieceSize,
        imageRect.y + off.y + y * previewPieceSize,
        previewPieceSize,
      )
      ctx.stroke(path)
    }
  }
  ctx.restore()
}

function createPuzzlePieces(
  img: HTMLCanvasElement,
  pieces: EncodedPiece[],
  info: PuzzleInfo,
  graphics: Graphics,
): HTMLCanvasElement[] {
  log.log('start createPuzzlePieces')
  const pieceSize = info.tileSize
  const pieceMarginWidth = info.tileMarginWidth
  const pieceDrawSize = info.tileDrawSize

  const bitmaps: HTMLCanvasElement[] = new Array(pieces.length)

  const paths: Record<number, Path2D> = {}
  function pathForShape(shape: PieceShape) {
    const key = Util.encodeShape(shape)
    if (!(key in paths)) {
      paths[key] = createPathForShape(shape, pieceMarginWidth, pieceMarginWidth, pieceSize)
    }
    return paths[key]
  }

  for (const piece of pieces) {
    const c = graphics.createCanvas(pieceDrawSize)
    const ctx = c.getContext('2d') as CanvasRenderingContext2D
    const c2 = graphics.createCanvas(pieceDrawSize)
    const ctx2 = c2.getContext('2d') as CanvasRenderingContext2D
    const pieceIdx = piece[EncodedPieceIdx.IDX]
    const srcRect = srcRectByIdx(info, pieceIdx)
    const path = pathForShape(Util.decodeShape(info.shapes[pieceIdx]))

    ctx.clearRect(0, 0, pieceDrawSize, pieceDrawSize)

    // stroke (slightly darker version of image)
    // -----------------------------------------------------------
    // -----------------------------------------------------------
    ctx.save()
    ctx.lineWidth = 2
    ctx.stroke(path)
    ctx.globalCompositeOperation = 'source-in'
    ctx.drawImage(
      img,
      srcRect.x - pieceMarginWidth,
      srcRect.y - pieceMarginWidth,
      pieceDrawSize,
      pieceDrawSize,
      0,
      0,
      pieceDrawSize,
      pieceDrawSize,
    )
    ctx.restore()
    ctx.save()
    ctx.globalCompositeOperation = 'source-in'
    ctx.globalAlpha = .2
    ctx.fillStyle = 'black'
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.restore()

    // main image
    // -----------------------------------------------------------
    // -----------------------------------------------------------
    ctx.save()
    ctx.clip(path)
    ctx.drawImage(
      img,
      srcRect.x - pieceMarginWidth,
      srcRect.y - pieceMarginWidth,
      pieceDrawSize,
      pieceDrawSize,
      0,
      0,
      pieceDrawSize,
      pieceDrawSize,
    )
    ctx.restore()

    // INSET SHADOW (bottom, right)
    // -----------------------------------------------------------
    // -----------------------------------------------------------
    ctx.save()
    ctx.clip(path)
    ctx.strokeStyle = 'rgba(0,0,0,.4)'
    ctx.lineWidth = 0
    ctx.shadowColor = 'black'
    ctx.shadowBlur = 2
    ctx.shadowOffsetX = -1
    ctx.shadowOffsetY = -1
    ctx.stroke(path)
    ctx.restore()

    // INSET SHADOW (top, left)
    // -----------------------------------------------------------
    // -----------------------------------------------------------
    ctx.save()
    ctx.clip(path)
    ctx.strokeStyle = 'rgba(255,255,255,.4)'
    ctx.lineWidth = 0
    ctx.shadowColor = 'white'
    ctx.shadowBlur = 2
    ctx.shadowOffsetX = 1
    ctx.shadowOffsetY = 1
    ctx.stroke(path)
    ctx.restore()

    // Redraw the path (border) in the color of the
    // tile, this makes the tile look more realistic
    // -----------------------------------------------------------
    // -----------------------------------------------------------
    ctx2.clearRect(0, 0, pieceDrawSize, pieceDrawSize)
    ctx2.save()
    ctx2.lineWidth = 1
    ctx2.stroke(path)
    ctx2.globalCompositeOperation = 'source-in'
    ctx2.drawImage(
      img,
      srcRect.x - pieceMarginWidth,
      srcRect.y - pieceMarginWidth,
      pieceDrawSize,
      pieceDrawSize,
      0,
      0,
      pieceDrawSize,
      pieceDrawSize,
    )
    ctx2.restore()
    ctx.drawImage(c2, 0, 0)

    bitmaps[pieceIdx] = c
  }

  log.log('end createPuzzlePieces')
  return bitmaps
}

function srcRectByIdx(puzzleInfo: PuzzleInfo, idx: number): Rect {
  const c = Util.coordByPieceIdxDeprecated(puzzleInfo, idx)
  return {
    x: c.x * puzzleInfo.tileSize,
    y: c.y * puzzleInfo.tileSize,
    w: puzzleInfo.tileSize,
    h: puzzleInfo.tileSize,
  }
}

async function loadPuzzleBitmap(
  puzzle: Puzzle,
  puzzleImageUrl: string,
  graphics: Graphics,
): Promise<HTMLCanvasElement> {
  const bmp = await graphics.loadImageToBitmap(puzzleImageUrl)
  return graphics.resizeBitmap(bmp, puzzle.info.width, puzzle.info.height)
}

export const createWebglStencil = async (
  graphics: Graphics,
  path: Path2D,
  size: number,
) => {
  const factor = 1.25

  // create a shadowed version of the path
  const c2 = graphics.createCanvas(size)
  const ctx2 = c2.getContext('2d')!
  ctx2.shadowColor = 'rgba(0,0,0,1)'
  ctx2.shadowOffsetX = -2 * factor
  ctx2.shadowOffsetY = -4 * factor
  ctx2.shadowBlur = 7 * factor
  ctx2.lineWidth = 3 * factor
  ctx2.stroke(path)
  ctx2.shadowColor = 'rgba(255,255,255,1)'
  ctx2.shadowOffsetX = + 2 * factor
  ctx2.shadowOffsetY = + 4 * factor
  ctx2.stroke(path)

  // create a magenta filled version of the path
  const c = graphics.createCanvas(size)
  const ctx = c.getContext('2d')!
  ctx.fillStyle = 'magenta'
  ctx.fillRect(0, 0, size, size)
  ctx.save()
  ctx.globalCompositeOperation = 'destination-out'
  ctx.clip(path)
  ctx.fill(path)
  ctx.globalCompositeOperation = 'source-over'
  ctx.drawImage(c2, 0, 0)
  ctx.restore()

  // stroke the path with a thin line (to remove some artifacts and
  // fill the outside of the piece, so they stick together without leaving gaps)
  ctx.save()
  ctx.lineWidth = 2
  ctx.fillStyle = 'rgba(0,0,0,0)'
  ctx.stroke(path)
  ctx.restore()

  // some artifacts remain after stroke path, so we need to clean up the pixels
  // we make all pixels that are NOT magenta and NOT grayscale into black
  const imageData = ctx.getImageData(0, 0, c.width, c.height)
  const pixels = imageData.data
  for (let i = 0; i < pixels.length; i += 4) {
    const color = pixels.slice(i, i + 4) as Color
    if (!colorEquals(color, COLOR_MAGENTA) && !colorIsGrayscale(color)) {
      pixels[i] = 0
      pixels[i + 1] = 0
      pixels[i + 2] = 0
    }
  }
  ctx.putImageData(imageData, 0, 0)

  return await createImageBitmap(c)
}

async function createWebglStencils(
  graphics: Graphics,
): Promise<Record<EncodedPieceShape, ImageBitmap>> {
  const SPRITE_SIZE = 256
  const SPRITE_DRAW_OFFSET = SPRITE_SIZE / 4
  const size = SPRITE_SIZE + 2 * SPRITE_DRAW_OFFSET
  const shapes: Record<EncodedPieceShape, ImageBitmap> = {}
  for (let top = -1; top <= 1; top++) {
    for (let bottom = -1; bottom <= 1; bottom++) {
      for (let left = -1; left <= 1; left++) {
        for (let right = -1; right <= 1; right++) {
          const shape: PieceShape = { top, bottom, left, right }
          const encodedShape = Util.encodeShape(shape)
          const path = createPathForShape(shape, SPRITE_DRAW_OFFSET, SPRITE_DRAW_OFFSET, SPRITE_SIZE)
          shapes[encodedShape] = await createWebglStencil(graphics, path, size)
        }
      }
    }
  }
  // draw the stencils 9x9 on a canvas for storing in the assets dir
  // const c = graphics.createCanvas(size * 9)
  // let x = 0
  // let y = 0
  // const ctx = c.getContext('2d')!
  // for (let top = -1; top <= 1; top++) {
  //   for (let bottom = -1; bottom <= 1; bottom++) {
  //     for (let left = -1; left <= 1; left++) {
  //       for (let right = -1; right <= 1; right++) {
  //         const shape: PieceShape = { top, bottom, left, right }
  //         const encodedShape = Util.encodeShape(shape)
  //         ctx.drawImage(shapes[encodedShape], x * size, y * size)
  //         x += 1
  //         if (x >= 9) {
  //           x = 0
  //           y += 1
  //         }
  //       }
  //     }
  //   }
  // }
  // document.body.append(c)
  // c.style.position = 'absolute'
  // c.style.left = '0'
  // c.style.top = '0'
  // c.style.zIndex = '1000'
  return shapes
}

async function createWebglStencilsFromPng(
  graphics: Graphics,
  bitmap: ImageBitmap,
): Promise<Record<EncodedPieceShape, ImageBitmap>> {
  // await createWebglStencils(graphics)
  const SPRITE_SIZE = 256
  const SPRITE_DRAW_OFFSET = SPRITE_SIZE / 4
  const size = SPRITE_SIZE + 2 * SPRITE_DRAW_OFFSET
  const shapes: Record<EncodedPieceShape, ImageBitmap> = {}

  let x = 0
  let y = 0
  const c = graphics.createCanvas(size)
  const ctx = c.getContext('2d')!
  for (let top = -1; top <= 1; top++) {
    for (let bottom = -1; bottom <= 1; bottom++) {
      for (let left = -1; left <= 1; left++) {
        for (let right = -1; right <= 1; right++) {
          const shape: PieceShape = { top, bottom, left, right }
          const encodedShape = Util.encodeShape(shape)
          ctx.clearRect(0, 0, size, size)
          ctx.drawImage(bitmap, x * size, y * size, size, size, 0, 0, size, size)
          x += 1
          if (x >= 9) {
            x = 0
            y += 1
          }
          shapes[encodedShape] = await createImageBitmap(c)
        }
      }
    }
  }
  return shapes
}

function loadPuzzleBitmaps(
  puzzleBitmap: HTMLCanvasElement,
  puzzle: Puzzle,
  graphics: Graphics,
): HTMLCanvasElement[] {
  return createPuzzlePieces(puzzleBitmap, puzzle.tiles, puzzle.info, graphics)
}

export default {
  loadPuzzleBitmap,
  loadPuzzleBitmaps,
  createWebglStencils,
  createWebglStencilsFromPng,
}
