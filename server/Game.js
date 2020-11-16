import { createPuzzle } from './Puzzle.js'
import Geometry from './../common/Geometry.js'

const GAMES = {}

function exists(gameId) {
  return (!!GAMES[gameId]) || false
}

async function createGame(gameId, targetTiles, image) {
  GAMES[gameId] = {
    puzzle: await createPuzzle(targetTiles, image),
    players: {},

    sockets: [],
    evtInfos: {},
  }
}

function addPlayer(gameId, playerId) {
  GAMES[gameId].players[playerId] = {
    id: playerId,
    x: 0,
    y: 0,
    down: false
  }
  GAMES[gameId].evtInfos[playerId] = {
    _last_mouse: null,
    _last_mouse_down: null,
  }
}

function addSocket(gameId, socket) {
  const sockets = GAMES[gameId].sockets

  if (!sockets.includes(socket)) {
    sockets.push(socket)
  }
}

function get(gameId) {
  return GAMES[gameId]
}

function getSockets(gameId) {
  return GAMES[gameId].sockets
}

function changePlayer(gameId, playerId, change) {
  for (let k of Object.keys(change)) {
    GAMES[gameId].players[playerId][k] = change[k]
  }
}

function changeData(gameId, change) {
  for (let k of Object.keys(change)) {
    GAMES[gameId].puzzle.data[k] = change[k]
  }
}

function changeTile(gameId, tileIdx, change) {
  for (let k of Object.keys(change)) {
    GAMES[gameId].puzzle.tiles[tileIdx][k] = change[k]
  }
}

const getTile = (gameId, tileIdx) => {
  return GAMES[gameId].puzzle.tiles[tileIdx]
}

const getTileGroup = (gameId, tileIdx) => {
  const tile = getTile(gameId, tileIdx)
  return tile.group
}

const getFinalTilePos = (gameId, tileIdx) => {
  const info = GAMES[gameId].puzzle.info
  const boardPos = {
    x: (info.table.width - info.width) / 2,
    y: (info.table.height - info.height) / 2
  }
  const srcPos = srcPosByTileIdx(gameId, tileIdx)
  return Geometry.pointAdd(boardPos, srcPos)
}

const getTilePos = (gameId, tileIdx) => {
  const tile = getTile(gameId, tileIdx)
  return tile.pos
}

const getTileZIndex = (gameId, tileIdx) => {
  const tile = getTile(gameId, tileIdx)
  return tile.z
}

const getFirstOwnedTileIdx = (gameId, userId) => {
  for (let t of GAMES[gameId].puzzle.tiles) {
    if (t.owner === userId) {
      return t.idx
    }
  }
  return -1
}

const getMaxGroup = (gameId) => {
  return GAMES[gameId].puzzle.data.maxGroup
}

const getMaxZIndex = (gameId) => {
  return GAMES[gameId].puzzle.data.maxZ
}

const getMaxZIndexByTileIdxs = (gameId, tileIdxs) => {
  let maxZ = 0
  for (let tileIdx of tileIdxs) {
    let tileZIndex = getTileZIndex(gameId, tileIdx)
    if (tileZIndex > maxZ) {
      maxZ = tileZIndex
    }
  }
  return maxZ
}

function srcPosByTileIdx(gameId, tileIdx) {
  const info = GAMES[gameId].puzzle.info

  const c = info.coords[tileIdx]
  const cx = c.x * info.tileSize
  const cy = c.y * info.tileSize

  return { x: cx, y: cy }
}

function getSurroundingTilesByIdx(gameId, tileIdx) {
  const info = GAMES[gameId].puzzle.info

  const _X = info.coords[tileIdx].x
  const _Y = info.coords[tileIdx].y

  return [
    // top
    (_Y > 0) ?               (tileIdx - info.tilesX) : -1,
    // right
    (_X < info.tilesX - 1) ? (tileIdx + 1)           : -1,
    // bottom
    (_Y < info.tilesY - 1) ? (tileIdx + info.tilesX) : -1,
    // left
    (_X > 0) ?               (tileIdx - 1)           : -1,
  ]
}

const setTilesZIndex = (gameId, tileIdxs, zIndex) => {
  for (let tilesIdx of tileIdxs) {
    changeTile(gameId, tilesIdx, { z: zIndex })
  }
}

const moveTileDiff = (gameId, tileIdx, diff) => {
  const oldPos = getTilePos(gameId, tileIdx)
  const pos = Geometry.pointAdd(oldPos, diff)
  changeTile(gameId, tileIdx, { pos })
}

const moveTilesDiff = (gameId, tileIdxs, diff) => {
  for (let tileIdx of tileIdxs) {
    moveTileDiff(gameId, tileIdx, diff)
  }
}

const finishTiles = (gameId, tileIdxs) => {
  for (let tileIdx of tileIdxs) {
    changeTile(gameId, tileIdx, { owner: -1, z: 1 })
  }
}

const setTilesOwner = (gameId, tileIdxs, owner) => {
  for (let tileIdx of tileIdxs) {
    changeTile(gameId, tileIdx, { owner })
  }
}

// get all grouped tiles for a tile
function getGroupedTileIdxs(gameId, tileIdx) {
  const tiles = GAMES[gameId].puzzle.tiles
  const tile = tiles[tileIdx]

  const grouped = []
  if (tile.group) {
    for (let other of tiles) {
      if (other.group === tile.group) {
        grouped.push(other.idx)
      }
    }
  } else {
    grouped.push(tile.idx)
  }
  return grouped
}

// Returns the index of the puzzle tile with the highest z index
// that is not finished yet and that matches the position
const freeTileIdxByPos = (gameId, pos) => {
  let info = GAMES[gameId].puzzle.info
  let tiles = GAMES[gameId].puzzle.tiles

  let maxZ = -1
  let tileIdx = -1
  for (let idx = 0; idx < tiles.length; idx++) {
    const tile = tiles[idx]
    if (tile.owner !== 0) {
      continue
    }

    const collisionRect = {
      x: tile.pos.x,
      y: tile.pos.y,
      w: info.tileSize,
      h: info.tileSize,
    }
    if (Geometry.pointInBounds(pos, collisionRect)) {
      if (maxZ === -1 || tile.z > maxZ) {
        maxZ = tile.z
        tileIdx = idx
      }
    }
  }
  return tileIdx
}

// determine if two tiles are grouped together
const areGrouped = (gameId, tileIdx1, tileIdx2) => {
  const g1 = getTileGroup(gameId, tileIdx1)
  const g2 = getTileGroup(gameId, tileIdx2)
  return g1 && g1 === g2
}

function handleInput(gameId, playerId, input) {
  let puzzle = GAMES[gameId].puzzle
  let players = GAMES[gameId].players
  let evtInfo = GAMES[gameId].evtInfos[playerId]

  let changes = []

  const _dataChange = () => {
    changes.push(['data', puzzle.data])
  }

  const _tileChange = (tileIdx) => {
    changes.push(['tile', getTile(gameId, tileIdx)])
  }

  const _tileChanges = (tileIdxs) => {
    for (let tileIdx of tileIdxs) {
      _tileChange(tileIdx)
    }
  }

  const _playerChange = () => {
    changes.push(['player', players[playerId]])
  }

  // put both tiles (and their grouped tiles) in the same group
  const groupTiles = (gameId, tileIdx1, tileIdx2) => {
    let tiles = GAMES[gameId].puzzle.tiles
    let group1 = getTileGroup(gameId, tileIdx1)
    let group2 = getTileGroup(gameId, tileIdx2)

    let group
    let searchGroups = []
    if (group1) {
      searchGroups.push(group1)
    }
    if (group2) {
      searchGroups.push(group2)
    }
    if (group1) {
      group = group1
    } else if (group2) {
      group = group2
    } else {
      let maxGroup = getMaxGroup(gameId) + 1
      changeData(gameId, { maxGroup })
      _dataChange()
      group = getMaxGroup(gameId)
    }

    changeTile(gameId, tileIdx1, { group })
    _tileChange(tileIdx1)
    changeTile(gameId, tileIdx2, { group })
    _tileChange(tileIdx2)

    // TODO: strange
    if (searchGroups.length > 0) {
      for (let tile of tiles) {
        if (searchGroups.includes(tile.group)) {
          changeTile(gameId, tile.idx, { group })
          _tileChange(tile.idx)
        }
      }
    }
  }

  let [type, x, y] = input
  let pos = {x, y}
  if (type === 'down') {
    changePlayer(gameId, playerId, { down: true })
    _playerChange()
    evtInfo._last_mouse_down = pos

    const tileIdxAtPos = freeTileIdxByPos(gameId, pos)
    if (tileIdxAtPos >= 0) {
      console.log('tile: ', tileIdxAtPos)
      let maxZ = getMaxZIndex(gameId) + 1
      changeData(gameId, { maxZ })
      _dataChange()
      const tileIdxs = getGroupedTileIdxs(gameId, tileIdxAtPos)
      setTilesZIndex(gameId, tileIdxs, getMaxZIndex(gameId))
      setTilesOwner(gameId, tileIdxs, playerId)
      _tileChanges(tileIdxs)
    }

  } else if (type === 'move') {
    changePlayer(gameId, playerId, pos)
    _playerChange()

    if (evtInfo._last_mouse_down !== null) {
      let tileIdx = getFirstOwnedTileIdx(gameId, playerId)
      if (tileIdx >= 0) {
        const diffX = x - evtInfo._last_mouse_down.x
        const diffY = y - evtInfo._last_mouse_down.y
        const diff = { x: diffX, y: diffY }
        const tileIdxs = getGroupedTileIdxs(gameId, tileIdx)
        moveTilesDiff(gameId, tileIdxs, diff)
        _tileChanges(tileIdxs)
      }

      evtInfo._last_mouse_down = pos
    }
  } else if (type === 'up') {
    changePlayer(gameId, playerId, { down: false })
    _playerChange()
    evtInfo._last_mouse_down = null

    let tileIdx = getFirstOwnedTileIdx(gameId, playerId)
    if (tileIdx >= 0) {
      // drop the tile(s)
      let tileIdxs = getGroupedTileIdxs(gameId, tileIdx)
      setTilesOwner(gameId, tileIdxs, 0)
      _tileChanges(tileIdxs)

      // Check if the tile was dropped near the final location
      let tilePos = getTilePos(gameId, tileIdx)
      let finalPos = getFinalTilePos(gameId, tileIdx)
      if (Geometry.pointDistance(finalPos, tilePos) < puzzle.info.snapDistance) {
        let diff = Geometry.pointSub(finalPos, tilePos)
        // Snap the tile to the final destination
        moveTilesDiff(gameId, tileIdxs, diff)
        finishTiles(gameId, tileIdxs)
        _tileChanges(tileIdxs)
      } else {
        // Snap to other tiles
        const check = (gameId, tileIdx, otherTileIdx, off) => {
          let info = GAMES[gameId].puzzle.info
          if (otherTileIdx < 0) {
            return false
          }
          if (areGrouped(gameId, tileIdx, otherTileIdx)) {
            return false
          }
          const tilePos = getTilePos(gameId, tileIdx)
          const dstPos = Geometry.pointAdd(
            getTilePos(gameId, otherTileIdx),
            {x: off[0] * info.tileSize, y: off[1] * info.tileSize}
          )
          if (Geometry.pointDistance(tilePos, dstPos) < info.snapDistance) {
            let diff = Geometry.pointSub(dstPos, tilePos)
            let tileIdxs = getGroupedTileIdxs(gameId, tileIdx)
            moveTilesDiff(gameId, tileIdxs, diff)
            groupTiles(gameId, tileIdx, otherTileIdx)
            tileIdxs = getGroupedTileIdxs(gameId, tileIdx)
            const zIndex = getMaxZIndexByTileIdxs(gameId, tileIdxs)
            console.log('z:' , zIndex, tileIdxs)
            setTilesZIndex(gameId, tileIdxs, zIndex)
            _tileChanges(tileIdxs)
            return true
          }
          return false
        }

        for (let tileIdxTmp of getGroupedTileIdxs(gameId, tileIdx)) {
          let othersIdxs = getSurroundingTilesByIdx(gameId, tileIdxTmp)
          if (
            check(gameId, tileIdxTmp, othersIdxs[0], [0, 1]) // top
            || check(gameId, tileIdxTmp, othersIdxs[1], [-1, 0]) // right
            || check(gameId, tileIdxTmp, othersIdxs[2], [0, -1]) // bottom
            || check(gameId, tileIdxTmp, othersIdxs[3], [1, 0]) // left
          ) {
            break
          }
        }
      }
    }
  }
  // console.log(mouse)
  evtInfo._last_mouse = pos

  return changes
}


export default {
  createGame,
  exists,
  addPlayer,
  addSocket,
  get,
  getSockets,
  handleInput,
}
