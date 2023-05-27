'use strict'

import Geometry, { Dim, Point, Rect } from '../../common/src/Geometry'
import Graphics from './Graphics'
import Util, { logger } from './../../common/src/Util'
import { Puzzle, PuzzleInfo, PieceShape, EncodedPiece, ShapeMode } from './../../common/src/Types'
import { determinePuzzlePieceShapes, PuzzleCreationInfo } from '../../common/src/Puzzle'
import { Rng } from '../../common/src/Rng'

const log = logger('PuzzleGraphics.js')

const CURVY_COORDS = [
  0, 0, 40, 15, 37, 5,
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

async function createPuzzleTileBitmaps(
  img: ImageBitmap,
  pieces: EncodedPiece[],
  info: PuzzleInfo,
): Promise<Array<ImageBitmap>> {
  log.log('start createPuzzleTileBitmaps')
  const pieceSize = info.tileSize
  const pieceMarginWidth = info.tileMarginWidth
  const pieceDrawSize = info.tileDrawSize

  const bitmaps: Array<ImageBitmap> = new Array(pieces.length)

  const paths: Record<number, Path2D> = {}
  function pathForShape(shape: PieceShape) {
    const key = Util.encodeShape(shape)
    if (!(key in paths)) {
      paths[key] = createPathForShape(shape, pieceMarginWidth, pieceMarginWidth, pieceSize)
    }
    return paths[key]
  }

  const c = Graphics.createCanvas(pieceDrawSize, pieceDrawSize)
  const ctx = c.getContext('2d') as CanvasRenderingContext2D

  const c2 = Graphics.createCanvas(pieceDrawSize, pieceDrawSize)
  const ctx2 = c2.getContext('2d') as CanvasRenderingContext2D

  for (const p of pieces) {
    const piece = Util.decodePiece(p)
    const srcRect = srcRectByIdx(info, piece.idx)
    const path = pathForShape(Util.decodeShape(info.shapes[piece.idx]))

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
    ctx.fillRect(0,0, c.width, c.height)
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

    bitmaps[piece.idx] = await createImageBitmap(c)
  }

  log.log('end createPuzzleTileBitmaps')
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

async function loadPuzzleBitmaps(puzzle: Puzzle, puzzleImageUrl: string): Promise<Array<ImageBitmap>> {
  // load bitmap, to determine the original size of the image
  const bmp = await Graphics.loadImageToBitmap(puzzleImageUrl)

  // creation of tile bitmaps
  // then create the final puzzle bitmap
  // NOTE: this can decrease OR increase in size!
  const bmpResized = await Graphics.resizeBitmap(bmp, puzzle.info.width, puzzle.info.height)
  return await createPuzzleTileBitmaps(bmpResized, puzzle.tiles, puzzle.info)
}

export default {
  loadPuzzleBitmaps,
}
