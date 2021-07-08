"use strict"

import Geometry, { Rect } from '../common/Geometry'
import Graphics from './Graphics'
import Util, { logger } from './../common/Util'
import { Puzzle, PuzzleInfo, PieceShape, EncodedPiece } from './../common/Types'

const log = logger('PuzzleGraphics.js')

async function createPuzzleTileBitmaps(
  img: ImageBitmap,
  pieces: EncodedPiece[],
  info: PuzzleInfo
): Promise<Array<ImageBitmap>> {
  log.log('start createPuzzleTileBitmaps')
  const tileSize = info.tileSize
  const tileMarginWidth = info.tileMarginWidth
  const tileDrawSize = info.tileDrawSize
  const tileRatio = tileSize / 100.0

  const curvyCoords = [
    0, 0, 40, 15, 37, 5,
    37, 5, 40, 0, 38, -5,
    38, -5, 20, -20, 50, -20,
    50, -20, 80, -20, 62, -5,
    62, -5, 60, 0, 63, 5,
    63, 5, 65, 15, 100, 0
  ];

  const bitmaps: Array<ImageBitmap> = new Array(pieces.length)

  const paths: Record<string, Path2D> = {}
  function pathForShape(shape: PieceShape) {
    const key = `${shape.top}${shape.right}${shape.left}${shape.bottom}`
    if (paths[key]) {
      return paths[key]
    }

    const path = new Path2D()
    const topLeftEdge = { x: tileMarginWidth, y: tileMarginWidth }
    const topRightEdge = Geometry.pointAdd(topLeftEdge, { x: tileSize, y: 0 })
    const bottomRightEdge = Geometry.pointAdd(topRightEdge, { x: 0, y: tileSize })
    const bottomLeftEdge = Geometry.pointSub(bottomRightEdge, { x: tileSize, y: 0 })

    path.moveTo(topLeftEdge.x, topLeftEdge.y)
    if (shape.top !== 0) {
      for (let i = 0; i < curvyCoords.length / 6; i++) {
        const p1 = Geometry.pointAdd(topLeftEdge, { x: curvyCoords[i * 6 + 0] * tileRatio, y: shape.top * curvyCoords[i * 6 + 1] * tileRatio })
        const p2 = Geometry.pointAdd(topLeftEdge, { x: curvyCoords[i * 6 + 2] * tileRatio, y: shape.top * curvyCoords[i * 6 + 3] * tileRatio })
        const p3 = Geometry.pointAdd(topLeftEdge, { x: curvyCoords[i * 6 + 4] * tileRatio, y: shape.top * curvyCoords[i * 6 + 5] * tileRatio })
        path.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
      }
    } else {
      path.lineTo(topRightEdge.x, topRightEdge.y)
    }
    if (shape.right !== 0) {
      for (let i = 0; i < curvyCoords.length / 6; i++) {
        const p1 = Geometry.pointAdd(topRightEdge, { x: -shape.right * curvyCoords[i * 6 + 1] * tileRatio, y: curvyCoords[i * 6 + 0] * tileRatio })
        const p2 = Geometry.pointAdd(topRightEdge, { x: -shape.right * curvyCoords[i * 6 + 3] * tileRatio, y: curvyCoords[i * 6 + 2] * tileRatio })
        const p3 = Geometry.pointAdd(topRightEdge, { x: -shape.right * curvyCoords[i * 6 + 5] * tileRatio, y: curvyCoords[i * 6 + 4] * tileRatio })
        path.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
      }
    } else {
      path.lineTo(bottomRightEdge.x, bottomRightEdge.y)
    }
    if (shape.bottom !== 0) {
      for (let i = 0; i < curvyCoords.length / 6; i++) {
        const p1 = Geometry.pointSub(bottomRightEdge, { x: curvyCoords[i * 6 + 0] * tileRatio, y: shape.bottom * curvyCoords[i * 6 + 1] * tileRatio })
        const p2 = Geometry.pointSub(bottomRightEdge, { x: curvyCoords[i * 6 + 2] * tileRatio, y: shape.bottom * curvyCoords[i * 6 + 3] * tileRatio })
        const p3 = Geometry.pointSub(bottomRightEdge, { x: curvyCoords[i * 6 + 4] * tileRatio, y: shape.bottom * curvyCoords[i * 6 + 5] * tileRatio })
        path.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
      }
    } else {
      path.lineTo(bottomLeftEdge.x, bottomLeftEdge.y)
    }
    if (shape.left !== 0) {
      for (let i = 0; i < curvyCoords.length / 6; i++) {
        const p1 = Geometry.pointSub(bottomLeftEdge, { x: -shape.left * curvyCoords[i * 6 + 1] * tileRatio, y: curvyCoords[i * 6 + 0] * tileRatio })
        const p2 = Geometry.pointSub(bottomLeftEdge, { x: -shape.left * curvyCoords[i * 6 + 3] * tileRatio, y: curvyCoords[i * 6 + 2] * tileRatio })
        const p3 = Geometry.pointSub(bottomLeftEdge, { x: -shape.left * curvyCoords[i * 6 + 5] * tileRatio, y: curvyCoords[i * 6 + 4] * tileRatio })
        path.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
      }
    } else {
      path.lineTo(topLeftEdge.x, topLeftEdge.y)
    }
    paths[key] = path
    return path
  }

  const c = Graphics.createCanvas(tileDrawSize, tileDrawSize)
  const ctx = c.getContext('2d') as CanvasRenderingContext2D

  const c2 = Graphics.createCanvas(tileDrawSize, tileDrawSize)
  const ctx2 = c2.getContext('2d') as CanvasRenderingContext2D

  for (const p of pieces) {
    const piece = Util.decodePiece(p)
    const srcRect = srcRectByIdx(info, piece.idx)
    const path = pathForShape(Util.decodeShape(info.shapes[piece.idx]))

    ctx.clearRect(0, 0, tileDrawSize, tileDrawSize)

    // stroke (slightly darker version of image)
    // -----------------------------------------------------------
    // -----------------------------------------------------------
    ctx.save()
    ctx.lineWidth = 2
    ctx.stroke(path)
    ctx.globalCompositeOperation = 'source-in'
    ctx.drawImage(
      img,
      srcRect.x - tileMarginWidth,
      srcRect.y - tileMarginWidth,
      tileDrawSize,
      tileDrawSize,
      0,
      0,
      tileDrawSize,
      tileDrawSize,
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
      srcRect.x - tileMarginWidth,
      srcRect.y - tileMarginWidth,
      tileDrawSize,
      tileDrawSize,
      0,
      0,
      tileDrawSize,
      tileDrawSize,
    )
    ctx.restore()

    // INSET SHADOW (bottom, right)
    // -----------------------------------------------------------
    // -----------------------------------------------------------
    ctx.save()
    ctx.clip(path)
    ctx.strokeStyle = 'rgba(0,0,0,.4)'
    ctx.lineWidth = 0
    ctx.shadowColor = "black";
    ctx.shadowBlur = 2;
    ctx.shadowOffsetX = -1;
    ctx.shadowOffsetY = -1;
    ctx.stroke(path)
    ctx.restore()

    // INSET SHADOW (top, left)
    // -----------------------------------------------------------
    // -----------------------------------------------------------
    ctx.save()
    ctx.clip(path)
    ctx.strokeStyle = 'rgba(255,255,255,.4)'
    ctx.lineWidth = 0
    ctx.shadowColor = "white";
    ctx.shadowBlur = 2;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    ctx.stroke(path)
    ctx.restore()

    // Redraw the path (border) in the color of the
    // tile, this makes the tile look more realistic
    // -----------------------------------------------------------
    // -----------------------------------------------------------
    ctx2.clearRect(0, 0, tileDrawSize, tileDrawSize)
    ctx2.save()
    ctx2.lineWidth = 1
    ctx2.stroke(path)
    ctx2.globalCompositeOperation = 'source-in'
    ctx2.drawImage(
      img,
      srcRect.x - tileMarginWidth,
      srcRect.y - tileMarginWidth,
      tileDrawSize,
      tileDrawSize,
      0,
      0,
      tileDrawSize,
      tileDrawSize,
    )
    ctx2.restore()
    ctx.drawImage(c2, 0, 0)

    bitmaps[piece.idx] = await createImageBitmap(c)
  }

  log.log('end createPuzzleTileBitmaps')
  return bitmaps
}

function srcRectByIdx(puzzleInfo: PuzzleInfo, idx: number): Rect {
  const c = Util.coordByPieceIdx(puzzleInfo, idx)
  return {
    x: c.x * puzzleInfo.tileSize,
    y: c.y * puzzleInfo.tileSize,
    w: puzzleInfo.tileSize,
    h: puzzleInfo.tileSize,
  }
}

async function loadPuzzleBitmaps(puzzle: Puzzle): Promise<Array<ImageBitmap>> {
  // load bitmap, to determine the original size of the image
  const bmp = await Graphics.loadImageToBitmap(puzzle.info.imageUrl)

  // creation of tile bitmaps
  // then create the final puzzle bitmap
  // NOTE: this can decrease OR increase in size!
  const bmpResized = await Graphics.resizeBitmap(bmp, puzzle.info.width, puzzle.info.height)
  return await createPuzzleTileBitmaps(bmpResized, puzzle.tiles, puzzle.info)
}

export default {
  loadPuzzleBitmaps,
}
