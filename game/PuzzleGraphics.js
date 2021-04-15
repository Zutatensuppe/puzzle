import Geometry from '../common/Geometry.js'
import Graphics from './Graphics.js'
import Util, { logger } from './../common/Util.js'

const log = logger('PuzzleGraphics.js')

async function createPuzzleTileBitmaps(img, tiles, info) {
  log.log('start createPuzzleTileBitmaps')
  var tileSize = info.tileSize
  var tileMarginWidth = info.tileMarginWidth
  var tileDrawSize = info.tileDrawSize
  var tileRatio = tileSize / 100.0

  var curvyCoords = [
    0, 0, 40, 15, 37, 5,
    37, 5, 40, 0, 38, -5,
    38, -5, 20, -20, 50, -20,
    50, -20, 80, -20, 62, -5,
    62, -5, 60, 0, 63, 5,
    63, 5, 65, 15, 100, 0
  ];

  const bitmaps = new Array(tiles.length)

  const paths = {}
  function pathForShape(shape) {
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
        let p1 = Geometry.pointSub(bottomRightEdge, { x: curvyCoords[i * 6 + 0] * tileRatio, y: shape.bottom * curvyCoords[i * 6 + 1] * tileRatio })
        let p2 = Geometry.pointSub(bottomRightEdge, { x: curvyCoords[i * 6 + 2] * tileRatio, y: shape.bottom * curvyCoords[i * 6 + 3] * tileRatio })
        let p3 = Geometry.pointSub(bottomRightEdge, { x: curvyCoords[i * 6 + 4] * tileRatio, y: shape.bottom * curvyCoords[i * 6 + 5] * tileRatio })
        path.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
      }
    } else {
      path.lineTo(bottomLeftEdge.x, bottomLeftEdge.y)
    }
    if (shape.left !== 0) {
      for (let i = 0; i < curvyCoords.length / 6; i++) {
        let p1 = Geometry.pointSub(bottomLeftEdge, { x: -shape.left * curvyCoords[i * 6 + 1] * tileRatio, y: curvyCoords[i * 6 + 0] * tileRatio })
        let p2 = Geometry.pointSub(bottomLeftEdge, { x: -shape.left * curvyCoords[i * 6 + 3] * tileRatio, y: curvyCoords[i * 6 + 2] * tileRatio })
        let p3 = Geometry.pointSub(bottomLeftEdge, { x: -shape.left * curvyCoords[i * 6 + 5] * tileRatio, y: curvyCoords[i * 6 + 4] * tileRatio })
        path.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
      }
    } else {
      path.lineTo(topLeftEdge.x, topLeftEdge.y)
    }
    paths[key] = path
    return path
  }

  for (let t of tiles) {
    const tile = Util.decodeTile(t)
    const srcRect = srcRectByIdx(info, tile.idx)
    const path = pathForShape(Util.decodeShape(info.shapes[tile.idx]))

    const c = Graphics.createCanvas(tileDrawSize, tileDrawSize)
    const ctx = c.getContext('2d')

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

    // -----------------------------------------------------------
    // -----------------------------------------------------------
    const tmpc = Graphics.createCanvas(tileDrawSize, tileDrawSize)
    const ctx2 = tmpc.getContext('2d')
    ctx2.save()
    ctx2.lineWidth = 1
    ctx2.stroke(path)
    ctx2.globalCompositeOperation = 'source-in'
    ctx2.drawImage(
      img,
      srcRect.x - tileMarginWidth - 50,
      srcRect.y - tileMarginWidth - 50,
      tileDrawSize + 100,
      tileDrawSize + 100,
      0 - 50,
      0 - 50,
      tileDrawSize + 100,
      tileDrawSize + 100,
    )
    ctx2.restore()
    // ctx2.save()
    // ctx2.globalCompositeOperation = 'source-in'
    // ctx2.globalAlpha = .1
    // ctx2.fillStyle = 'black'
    // ctx2.fillRect(0,0, c.width, c.height)
    // ctx2.restore()
    // ctx.globalCompositeOperation = 'darken'
    ctx.drawImage(tmpc, 0, 0)


    bitmaps[tile.idx] = await createImageBitmap(c)
  }

  log.log('end createPuzzleTileBitmaps')
  return bitmaps
}

function srcRectByIdx(puzzleInfo, idx) {
  const c = Util.coordByTileIdx(puzzleInfo, idx)
  return {
    x: c.x * puzzleInfo.tileSize,
    y: c.y * puzzleInfo.tileSize,
    w: puzzleInfo.tileSize,
    h: puzzleInfo.tileSize,
  }
}

async function loadPuzzleBitmaps(puzzle) {
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