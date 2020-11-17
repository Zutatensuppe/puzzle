import Geometry from '../common/Geometry.js'
import Graphics from './Graphics.js'

async function createPuzzleTileBitmaps(img, tiles, info) {
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
    path.moveTo(topLeftEdge.x, topLeftEdge.y)
    for (let i = 0; i < curvyCoords.length / 6; i++) {
      const p1 = Geometry.pointAdd(topLeftEdge, { x: curvyCoords[i * 6 + 0] * tileRatio, y: shape.top * curvyCoords[i * 6 + 1] * tileRatio })
      const p2 = Geometry.pointAdd(topLeftEdge, { x: curvyCoords[i * 6 + 2] * tileRatio, y: shape.top * curvyCoords[i * 6 + 3] * tileRatio })
      const p3 = Geometry.pointAdd(topLeftEdge, { x: curvyCoords[i * 6 + 4] * tileRatio, y: shape.top * curvyCoords[i * 6 + 5] * tileRatio })
      path.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
    }
    const topRightEdge = Geometry.pointAdd(topLeftEdge, { x: tileSize, y: 0 })
    for (let i = 0; i < curvyCoords.length / 6; i++) {
      const p1 = Geometry.pointAdd(topRightEdge, { x: -shape.right * curvyCoords[i * 6 + 1] * tileRatio, y: curvyCoords[i * 6 + 0] * tileRatio })
      const p2 = Geometry.pointAdd(topRightEdge, { x: -shape.right * curvyCoords[i * 6 + 3] * tileRatio, y: curvyCoords[i * 6 + 2] * tileRatio })
      const p3 = Geometry.pointAdd(topRightEdge, { x: -shape.right * curvyCoords[i * 6 + 5] * tileRatio, y: curvyCoords[i * 6 + 4] * tileRatio })
      path.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
    }
    const bottomRightEdge = Geometry.pointAdd(topRightEdge, { x: 0, y: tileSize })
    for (let i = 0; i < curvyCoords.length / 6; i++) {
      let p1 = Geometry.pointSub(bottomRightEdge, { x: curvyCoords[i * 6 + 0] * tileRatio, y: shape.bottom * curvyCoords[i * 6 + 1] * tileRatio })
      let p2 = Geometry.pointSub(bottomRightEdge, { x: curvyCoords[i * 6 + 2] * tileRatio, y: shape.bottom * curvyCoords[i * 6 + 3] * tileRatio })
      let p3 = Geometry.pointSub(bottomRightEdge, { x: curvyCoords[i * 6 + 4] * tileRatio, y: shape.bottom * curvyCoords[i * 6 + 5] * tileRatio })
      path.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
    }
    const bottomLeftEdge = Geometry.pointSub(bottomRightEdge, { x: tileSize, y: 0 })
    for (let i = 0; i < curvyCoords.length / 6; i++) {
      let p1 = Geometry.pointSub(bottomLeftEdge, { x: -shape.left * curvyCoords[i * 6 + 1] * tileRatio, y: curvyCoords[i * 6 + 0] * tileRatio })
      let p2 = Geometry.pointSub(bottomLeftEdge, { x: -shape.left * curvyCoords[i * 6 + 3] * tileRatio, y: curvyCoords[i * 6 + 2] * tileRatio })
      let p3 = Geometry.pointSub(bottomLeftEdge, { x: -shape.left * curvyCoords[i * 6 + 5] * tileRatio, y: curvyCoords[i * 6 + 4] * tileRatio })
      path.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
    }
    paths[key] = path
    return path
  }

  for (let tile of tiles) {
    const srcRect = srcRectByIdx(info, tile.idx)
    const path = pathForShape(info.shapes[tile.idx])

    const c = Graphics.createCanvas(tileDrawSize, tileDrawSize)
    const ctx = c.getContext('2d')
    // -----------------------------------------------------------
    // -----------------------------------------------------------
    ctx.lineWidth = 2
    ctx.stroke(path)
    // -----------------------------------------------------------
    // -----------------------------------------------------------
    ctx.save();
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
    ctx.stroke(path)
    ctx.restore();

    bitmaps[tile.idx] = await createImageBitmap(c)
  }

  return bitmaps
}

function srcRectByIdx(puzzleInfo, idx) {
  const c = puzzleInfo.coords[idx]
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
