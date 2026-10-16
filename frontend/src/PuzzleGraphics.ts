'use strict'

import Geometry from '@common/Geometry'
import type { Dim, Point, Rect } from '@common/Geometry'
import Util, { logger } from '@common/Util'
import { EncodedPieceIdx } from '@common/Types'
import type { Puzzle, PuzzleInfo, PieceShape, ShapeMode, EncodedPieceShape } from '@common/Types'
import { determinePuzzlePieceShapes } from '@common/Puzzle'
import type { PuzzleCreationInfo } from '@common/Puzzle'
import { Rng } from '@common/Rng'
import type { Graphics } from './Graphics'

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

/**
 * The canvas look of one piece with baked-in bevel shading: `image` is drawn
 * with its (sx, sy) at the top left of the piece's draw area, cut along `path`.
 */
function cutPiece(
  image: CanvasImageSource,
  sx: number,
  sy: number,
  path: Path2D,
  pieceDrawSize: number,
  graphics: Graphics,
): HTMLCanvasElement {
  const c = graphics.createCanvas(pieceDrawSize)
  const ctx = c.getContext('2d')!
  const c2 = graphics.createCanvas(pieceDrawSize)
  const ctx2 = c2.getContext('2d')!

  ctx.clearRect(0, 0, pieceDrawSize, pieceDrawSize)

  // stroke (slightly darker version of image)
  // -----------------------------------------------------------
  // -----------------------------------------------------------
  ctx.save()
  ctx.lineWidth = 2
  ctx.stroke(path)
  ctx.globalCompositeOperation = 'source-in'
  ctx.drawImage(image, sx, sy, pieceDrawSize, pieceDrawSize, 0, 0, pieceDrawSize, pieceDrawSize)
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
  ctx.drawImage(image, sx, sy, pieceDrawSize, pieceDrawSize, 0, 0, pieceDrawSize, pieceDrawSize)
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
  ctx2.drawImage(image, sx, sy, pieceDrawSize, pieceDrawSize, 0, 0, pieceDrawSize, pieceDrawSize)
  ctx2.restore()
  ctx.drawImage(c2, 0, 0)

  return c
}

function loadPuzzleBitmaps(
  image: HTMLCanvasElement,
  puzzle: Puzzle,
  graphics: Graphics,
): HTMLCanvasElement[] {
  log.log('start loadPuzzleBitmaps')
  const pieces = puzzle.tiles
  const info = puzzle.info
  const pieceSize = info.tileSize
  const pieceMarginWidth = info.tileMarginWidth
  const pieceDrawSize = info.tileDrawSize

  const images: HTMLCanvasElement[] = new Array(pieces.length)

  const paths: Record<number, Path2D> = {}
  function pathForShape(shape: PieceShape) {
    const key = Util.encodeShape(shape)
    if (!(key in paths)) {
      paths[key] = createPathForShape(shape, pieceMarginWidth, pieceMarginWidth, pieceSize)
    }
    return paths[key]
  }

  for (const piece of pieces) {
    const pieceIdx = piece[EncodedPieceIdx.IDX]
    const srcRect = srcRectByIdx(info, pieceIdx)
    const path = pathForShape(Util.decodeShape(info.shapes[pieceIdx]))
    images[pieceIdx] = cutPiece(
      image,
      srcRect.x - pieceMarginWidth,
      srcRect.y - pieceMarginWidth,
      path,
      pieceDrawSize,
      graphics,
    )
  }

  log.log('end loadPuzzleBitmaps')
  return images
}

export type PieceShapeSheetsPuzzleInfo = Pick<PuzzleInfo, 'tileSize' | 'tileMarginWidth' | 'tileDrawSize'>

/**
 * The look of `cutPiece`, split into two image-independent layers, for all 81
 * piece shapes. Each sheet holds one draw area per shape at `positions[shape]`.
 *
 * `cutPiece` is linear in the image colour I: out = A * ((1 - b) * I + b * O).
 * Cutting a solid black and a solid white image gives, per pixel, the alpha A,
 * the shading strength b = 1 - (white - black) and the shading colour
 * O = black / b.
 * - `mask`: white with alpha A, cuts the piece out of the image
 * - `shade`: gray O with alpha b * A, drawn on top of the cut piece
 * Drawing the shade over the masked image reproduces `cutPiece` exactly where
 * A = 1, and approximately on the faint outer ring of the piece.
 */
export interface PieceShapeSheets {
  pieceDrawSize: number
  mask: HTMLCanvasElement
  shade: HTMLCanvasElement
  positions: Record<EncodedPieceShape, Point>
}

const SHAPE_SHEET_COLUMNS = 9

function createPieceShapeSheets(
  info: PieceShapeSheetsPuzzleInfo,
  graphics: Graphics,
): PieceShapeSheets {
  const drawSize = info.tileDrawSize
  const sheetSize = SHAPE_SHEET_COLUMNS * drawSize
  const solid = (color: string) => {
    const c = graphics.createCanvas(drawSize)
    const ctx = c.getContext('2d')!
    ctx.fillStyle = color
    ctx.fillRect(0, 0, drawSize, drawSize)
    return c
  }
  const black = solid('#000')
  const white = solid('#fff')
  const blackCuts = graphics.createCanvas(sheetSize)
  const whiteCuts = graphics.createCanvas(sheetSize)
  const blackCutsCtx = blackCuts.getContext('2d', { willReadFrequently: true })!
  const whiteCutsCtx = whiteCuts.getContext('2d', { willReadFrequently: true })!

  const positions: Record<EncodedPieceShape, Point> = {}
  let i = 0
  for (const top of [-1, 0, 1]) {
    for (const right of [-1, 0, 1]) {
      for (const bottom of [-1, 0, 1]) {
        for (const left of [-1, 0, 1]) {
          const shape: PieceShape = { top, right, bottom, left }
          const path = createPathForShape(shape, info.tileMarginWidth, info.tileMarginWidth, info.tileSize)
          const pos = { x: (i % SHAPE_SHEET_COLUMNS) * drawSize, y: Math.floor(i / SHAPE_SHEET_COLUMNS) * drawSize }
          blackCutsCtx.drawImage(cutPiece(black, 0, 0, path, drawSize, graphics), pos.x, pos.y)
          whiteCutsCtx.drawImage(cutPiece(white, 0, 0, path, drawSize, graphics), pos.x, pos.y)
          positions[Util.encodeShape(shape)] = pos
          i++
        }
      }
    }
  }

  const blackCut = blackCutsCtx.getImageData(0, 0, sheetSize, sheetSize).data
  const whiteCut = whiteCutsCtx.getImageData(0, 0, sheetSize, sheetSize).data
  const mask = graphics.createCanvas(sheetSize)
  const shade = graphics.createCanvas(sheetSize)
  const maskCtx = mask.getContext('2d')!
  const shadeCtx = shade.getContext('2d')!
  const maskData = maskCtx.createImageData(sheetSize, sheetSize)
  const shadeData = shadeCtx.createImageData(sheetSize, sheetSize)
  const maskPixels = maskData.data
  const shadePixels = shadeData.data
  for (let p = 0; p < blackCut.length; p += 4) {
    const alpha = Math.max(blackCut[p + 3], whiteCut[p + 3]) / 255
    if (alpha === 0) {
      continue
    }
    const onBlack = (blackCut[p] + blackCut[p + 1] + blackCut[p + 2]) / (3 * 255)
    const onWhite = (whiteCut[p] + whiteCut[p + 1] + whiteCut[p + 2]) / (3 * 255)
    const strength = Math.min(1, Math.max(0, 1 - (onWhite - onBlack)))
    // below 1/255 the shading is invisible and its colour is only noise
    const gray = strength > 1 / 255 ? Math.min(1, Math.max(0, onBlack / strength)) : 0
    maskPixels[p] = maskPixels[p + 1] = maskPixels[p + 2] = 255
    maskPixels[p + 3] = Math.round(alpha * 255)
    shadePixels[p] = shadePixels[p + 1] = shadePixels[p + 2] = Math.round(gray * 255)
    shadePixels[p + 3] = Math.round(strength * alpha * 255)
  }
  maskCtx.putImageData(maskData, 0, 0)
  shadeCtx.putImageData(shadeData, 0, 0)

  // release the cut sheets right away instead of waiting for GC
  blackCuts.width = whiteCuts.width = 0
  return { pieceDrawSize: drawSize, mask, shade, positions }
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
  const image = await graphics.loader.imageBitmapFromSrc(puzzleImageUrl)
  return graphics.op.resize(image, puzzle.info.width, puzzle.info.height)
}

async function createWebglStencilsFromPng(
  gfx: Graphics,
  image: ImageBitmap,
): Promise<Record<EncodedPieceShape, ImageBitmap>> {
  const SPRITE_SIZE = 256
  const SPRITE_DRAW_OFFSET = SPRITE_SIZE / 4
  const size = SPRITE_SIZE + 2 * SPRITE_DRAW_OFFSET
  const shapes: Record<EncodedPieceShape, ImageBitmap> = {}

  let x = 0
  let y = 0
  for (let top = -1; top <= 1; top++) {
    for (let bottom = -1; bottom <= 1; bottom++) {
      for (let left = -1; left <= 1; left++) {
        for (let right = -1; right <= 1; right++) {
          const shape: PieceShape = { top, bottom, left, right }
          const encodedShape = Util.encodeShape(shape)
          const c = gfx.createCanvas(size)
          const ctx = c.getContext('2d')!
          ctx.clearRect(0, 0, size, size)
          ctx.drawImage(image, x * size, y * size, size, size, 0, 0, size, size)
          x += 1
          if (x >= 9) {
            x = 0
            y += 1
          }
          shapes[encodedShape] = await gfx.loader.imageBitmapFromCanvas(c)
        }
      }
    }
  }
  return shapes
}

export default {
  loadPuzzleBitmap,
  loadPuzzleBitmaps,
  createPieceShapeSheets,
  createWebglStencilsFromPng,
}
