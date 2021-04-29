import Geometry from './Geometry.js'
import Protocol from './Protocol.js'
import Time from './Time.js'
import Util from './Util.js'

const SCORE_MODE_FINAL = 0
const SCORE_MODE_ANY = 1

// Map<gameId, GameObject>
const GAMES = {}

function exists(gameId) {
  return (!!GAMES[gameId]) || false
}

function __createPlayerObject(id, ts) {
  return {
    id: id,
    x: 0,
    y: 0,
    d: 0, // mouse down
    name: null, // 'anon'
    color: null, // '#ffffff'
    bgcolor: null, // '#222222'
    points: 0,
    ts: ts,
  }
}

function setGame(gameId, game) {
  GAMES[gameId] = game
}

function getPlayerIndexById(gameId, playerId) {
  let i = 0;
  for (let player of GAMES[gameId].players) {
    if (Util.decodePlayer(player).id === playerId) {
      return i
    }
    i++
  }
  return -1
}

function getPlayerIdByIndex(gameId, playerIndex) {
  if (GAMES[gameId].players.length > playerIndex) {
    return Util.decodePlayer(GAMES[gameId].players[playerIndex]).id
  }
  return null
}

function getPlayer(gameId, playerId) {
  let idx = getPlayerIndexById(gameId, playerId)
  return Util.decodePlayer(GAMES[gameId].players[idx])
}

function setPlayer(gameId, playerId, player) {
  let idx = getPlayerIndexById(gameId, playerId)
  if (idx === -1) {
    GAMES[gameId].players.push(Util.encodePlayer(player))
  } else {
    GAMES[gameId].players[idx] = Util.encodePlayer(player)
  }
}

function setTile(gameId, tileIdx, tile) {
  GAMES[gameId].puzzle.tiles[tileIdx] = Util.encodeTile(tile)
}

function setPuzzleData(gameId, data) {
  GAMES[gameId].puzzle.data = data
}

function playerExists(gameId, playerId) {
  const idx = getPlayerIndexById(gameId, playerId)
  return idx !== -1
}

function getRelevantPlayers(gameId, ts) {
  const minTs = ts - 30 * Time.SEC
  return getAllPlayers(gameId).filter(player => {
    return player.ts >= minTs || player.points > 0
  })
}

function getActivePlayers(gameId, ts) {
  const minTs = ts - 30 * Time.SEC
  return getAllPlayers(gameId).filter(player => {
    return player.ts >= minTs
  })
}

function addPlayer(gameId, playerId, ts) {
  if (!playerExists(gameId, playerId)) {
    setPlayer(gameId, playerId, __createPlayerObject(playerId, ts))
  } else {
    changePlayer(gameId, playerId, { ts })
  }
}

function getEvtInfo(gameId, playerId) {
  if (playerId in GAMES[gameId].evtInfos) {
    return GAMES[gameId].evtInfos[playerId]
  }
  return {
    _last_mouse: null,
    _last_mouse_down: null,
  }
}

function setEvtInfo(gameId, playerId, evtInfo) {
  GAMES[gameId].evtInfos[playerId] = evtInfo
}

function getAllGames() {
  return Object.values(GAMES).sort((a, b) => {
    // when both have same finished state, sort by started
    if (isFinished(a.id) === isFinished(b.id)) {
      return b.puzzle.data.started - a.puzzle.data.started
    }
    // otherwise, sort: unfinished, finished
    return isFinished(a.id) ? 1 : -1
  })
}

function getAllPlayers(gameId) {
  return GAMES[gameId]
    ? GAMES[gameId].players.map(Util.decodePlayer)
    : []
}

function get(gameId) {
  return GAMES[gameId]
}

function getTileCount(gameId) {
  return GAMES[gameId].puzzle.tiles.length
}

function getImageUrl(gameId) {
  return GAMES[gameId].puzzle.info.imageUrl
}

function setImageUrl(gameId, imageUrl) {
  GAMES[gameId].puzzle.info.imageUrl = imageUrl
}

function getScoreMode(gameId) {
  return GAMES[gameId].scoreMode || SCORE_MODE_FINAL
}

function isFinished(gameId) {
  return getFinishedTileCount(gameId) === getTileCount(gameId)
}

function getFinishedTileCount(gameId) {
  let count = 0
  for (let t of GAMES[gameId].puzzle.tiles) {
    if (Util.decodeTile(t).owner === -1) {
      count++
    }
  }
  return count
}

function getTilesSortedByZIndex(gameId) {
  const tiles = GAMES[gameId].puzzle.tiles.map(Util.decodeTile)
  return tiles.sort((t1, t2) => t1.z - t2.z)
}

function changePlayer(gameId, playerId, change) {
  const player = getPlayer(gameId, playerId)
  for (let k of Object.keys(change)) {
    player[k] = change[k]
  }
  setPlayer(gameId, playerId, player)
}

function changeData(gameId, change) {
  for (let k of Object.keys(change)) {
    GAMES[gameId].puzzle.data[k] = change[k]
  }
}

function changeTile(gameId, tileIdx, change) {
  for (let k of Object.keys(change)) {
    const tile = Util.decodeTile(GAMES[gameId].puzzle.tiles[tileIdx])
    tile[k] = change[k]
    GAMES[gameId].puzzle.tiles[tileIdx] = Util.encodeTile(tile)
  }
}

const getTile = (gameId, tileIdx) => {
  return Util.decodeTile(GAMES[gameId].puzzle.tiles[tileIdx])
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

// todo: instead, just make the table bigger and use that :)
const getBounds = (gameId) => {
  const tw = getTableWidth(gameId)
  const th = getTableHeight(gameId)

  const overX = Math.round(tw / 4)
  const overY = Math.round(th / 4)
  return {
    x: 0 - overX,
    y: 0 - overY,
    w: tw + 2 * overX,
    h: th + 2 * overY,
  }
}

const getTileBounds = (gameId, tileIdx) => {
  const s = getTileSize(gameId)
  const tile = getTile(gameId, tileIdx)
  return {
    x: tile.pos.x,
    y: tile.pos.y,
    w: s,
    h: s,
  }
}

const getTileZIndex = (gameId, tileIdx) => {
  const tile = getTile(gameId, tileIdx)
  return tile.z
}

const getFirstOwnedTileIdx = (gameId, userId) => {
  for (let t of GAMES[gameId].puzzle.tiles) {
    const tile = Util.decodeTile(t)
    if (tile.owner === userId) {
      return tile.idx
    }
  }
  return -1
}

const getFirstOwnedTile = (gameId, userId) => {
  const idx = getFirstOwnedTileIdx(gameId, userId)
  return idx < 0 ? null : GAMES[gameId].puzzle.tiles[idx]
}

const getTileDrawOffset = (gameId) => {
  return GAMES[gameId].puzzle.info.tileDrawOffset
}

const getTileDrawSize = (gameId) => {
  return GAMES[gameId].puzzle.info.tileDrawSize
}

const getTileSize = (gameId) => {
  return GAMES[gameId].puzzle.info.tileSize
}

const getStartTs = (gameId) => {
  return GAMES[gameId].puzzle.data.started
}

const getFinishTs = (gameId) => {
  return GAMES[gameId].puzzle.data.finished
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

  const c = Util.coordByTileIdx(info, tileIdx)
  const cx = c.x * info.tileSize
  const cy = c.y * info.tileSize

  return { x: cx, y: cy }
}

function getSurroundingTilesByIdx(gameId, tileIdx) {
  const info = GAMES[gameId].puzzle.info

  const c = Util.coordByTileIdx(info, tileIdx)

  return [
    // top
    (c.y > 0) ?               (tileIdx - info.tilesX) : -1,
    // right
    (c.x < info.tilesX - 1) ? (tileIdx + 1)           : -1,
    // bottom
    (c.y < info.tilesY - 1) ? (tileIdx + info.tilesX) : -1,
    // left
    (c.x > 0) ?               (tileIdx - 1)           : -1,
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
  const tileDrawSize = getTileDrawSize(gameId)
  const bounds = getBounds(gameId)
  const cappedDiff = diff

  for (let tileIdx of tileIdxs) {
    const t = getTile(gameId, tileIdx)
    if (t.pos.x + diff.x < bounds.x) {
      cappedDiff.x = Math.max(bounds.x - t.pos.x, cappedDiff.x)
    } else if (t.pos.x + tileDrawSize + diff.x > bounds.x + bounds.w) {
      cappedDiff.x = Math.min(bounds.x + bounds.w - t.pos.x + tileDrawSize, cappedDiff.x)
    }
    if (t.pos.y + diff.y < bounds.y) {
      cappedDiff.y = Math.max(bounds.y - t.pos.y, cappedDiff.y)
    } else if (t.pos.y + tileDrawSize + diff.y > bounds.y + bounds.h) {
      cappedDiff.y = Math.min(bounds.y + bounds.h - t.pos.y + tileDrawSize, cappedDiff.y)
    }
  }

  for (let tileIdx of tileIdxs) {
    moveTileDiff(gameId, tileIdx, cappedDiff)
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
  const tile = Util.decodeTile(tiles[tileIdx])

  const grouped = []
  if (tile.group) {
    for (let other of tiles) {
      const otherTile = Util.decodeTile(other)
      if (otherTile.group === tile.group) {
        grouped.push(otherTile.idx)
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
    const tile = Util.decodeTile(tiles[idx])
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

const getPlayerBgColor = (gameId, playerId) => {
  const p = getPlayer(gameId, playerId)
  return p ? p.bgcolor : null
}

const getPlayerColor = (gameId, playerId) => {
  const p = getPlayer(gameId, playerId)
  return p ? p.color : null
}

const getPlayerName = (gameId, playerId) => {
  const p = getPlayer(gameId, playerId)
  return p ? p.name : null
}

const getPlayerPoints = (gameId, playerId) => {
  const p = getPlayer(gameId, playerId)
  return p ? p.points : null
}

// determine if two tiles are grouped together
const areGrouped = (gameId, tileIdx1, tileIdx2) => {
  const g1 = getTileGroup(gameId, tileIdx1)
  const g2 = getTileGroup(gameId, tileIdx2)
  return g1 && g1 === g2
}

const getTableWidth = (gameId) => {
  return GAMES[gameId].puzzle.info.table.width
}

const getTableHeight = (gameId) => {
  return GAMES[gameId].puzzle.info.table.height
}

const getPuzzle = (gameId) => {
  return GAMES[gameId].puzzle
}

const getRng = (gameId) => {
  return GAMES[gameId].rng.obj
}

const getPuzzleWidth = (gameId) => {
  return GAMES[gameId].puzzle.info.width
}

const getPuzzleHeight = (gameId) => {
  return GAMES[gameId].puzzle.info.height
}

function handleInput(gameId, playerId, input, ts) {
  const puzzle = GAMES[gameId].puzzle
  let evtInfo = getEvtInfo(gameId, playerId)

  let changes = []

  const _dataChange = () => {
    changes.push([Protocol.CHANGE_DATA, puzzle.data])
  }

  const _tileChange = (tileIdx) => {
    changes.push([Protocol.CHANGE_TILE, getTile(gameId, tileIdx)])
  }

  const _tileChanges = (tileIdxs) => {
    for (let tileIdx of tileIdxs) {
      _tileChange(tileIdx)
    }
  }

  const _playerChange = () => {
    changes.push([Protocol.CHANGE_PLAYER, Util.encodePlayer(getPlayer(gameId, playerId))])
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
      for (let t of tiles) {
        const tile = Util.decodeTile(t)
        if (searchGroups.includes(tile.group)) {
          changeTile(gameId, tile.idx, { group })
          _tileChange(tile.idx)
        }
      }
    }
  }

  const type = input[0]
  if (type === Protocol.INPUT_EV_BG_COLOR) {
    const bgcolor = input[1]
    changePlayer(gameId, playerId, { bgcolor, ts })
    _playerChange()
  } else if (type === Protocol.INPUT_EV_PLAYER_COLOR) {
    const color = input[1]
    changePlayer(gameId, playerId, { color, ts })
    _playerChange()
  } else if (type === Protocol.INPUT_EV_PLAYER_NAME) {
    const name = `${input[1]}`.substr(0, 16)
    changePlayer(gameId, playerId, { name, ts })
    _playerChange()
  } else if (type === Protocol.INPUT_EV_MOUSE_DOWN) {
    const x = input[1]
    const y = input[2]
    const pos = {x, y}

    changePlayer(gameId, playerId, { d: 1, ts })
    _playerChange()
    evtInfo._last_mouse_down = pos

    const tileIdxAtPos = freeTileIdxByPos(gameId, pos)
    if (tileIdxAtPos >= 0) {
      let maxZ = getMaxZIndex(gameId) + 1
      changeData(gameId, { maxZ })
      _dataChange()
      const tileIdxs = getGroupedTileIdxs(gameId, tileIdxAtPos)
      setTilesZIndex(gameId, tileIdxs, getMaxZIndex(gameId))
      setTilesOwner(gameId, tileIdxs, playerId)
      _tileChanges(tileIdxs)
    }
    evtInfo._last_mouse = pos

  } else if (type === Protocol.INPUT_EV_MOUSE_MOVE) {
    const x = input[1]
    const y = input[2]
    const pos = {x, y}

    if (evtInfo._last_mouse_down === null) {
      // player is just moving the hand
      changePlayer(gameId, playerId, {x, y, ts})
      _playerChange()
    } else {
      let tileIdx = getFirstOwnedTileIdx(gameId, playerId)
      if (tileIdx >= 0) {
        // player is moving a tile (and hand)
        changePlayer(gameId, playerId, {x, y, ts})
        _playerChange()

        // check if pos is on the tile, otherwise dont move
        // (mouse could be out of table, but tile stays on it)
        const tileIdxs = getGroupedTileIdxs(gameId, tileIdx)
        let anyOk = Geometry.pointInBounds(pos, getBounds(gameId))
          && Geometry.pointInBounds(evtInfo._last_mouse_down, getBounds(gameId))
        for (let idx of tileIdxs) {
          const bounds = getTileBounds(gameId, idx)
          if (Geometry.pointInBounds(pos, bounds)) {
            anyOk = true
            break
          }
        }
        if (anyOk) {
          const diffX = x - evtInfo._last_mouse_down.x
          const diffY = y - evtInfo._last_mouse_down.y

          const diff = { x: diffX, y: diffY }
          moveTilesDiff(gameId, tileIdxs, diff)

          _tileChanges(tileIdxs)
        }
      } else {
        // player is just moving map, so no change in position!
        changePlayer(gameId, playerId, {ts})
        _playerChange()
      }

      evtInfo._last_mouse_down = pos
    }
    evtInfo._last_mouse = pos

  } else if (type === Protocol.INPUT_EV_MOUSE_UP) {
    const x = input[1]
    const y = input[2]
    const pos = {x, y}

    changePlayer(gameId, playerId, { d: 0, ts })
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

        if (getScoreMode(gameId) === SCORE_MODE_FINAL) {
          changePlayer(gameId, playerId, {
            points: getPlayerPoints(gameId, playerId) + tileIdxs.length,
          })
          _playerChange()
        } else if (getScoreMode(gameId) === SCORE_MODE_ANY) {
          changePlayer(gameId, playerId, {
            points: getPlayerPoints(gameId, playerId) + 1,
          })
          _playerChange()
        } else {
          // no score mode... should never occur, because there is a
          // fallback to SCORE_MODE_FINAL in getScoreMode function
        }

        // check if the puzzle is finished
        if (getFinishedTileCount(gameId) === getTileCount(gameId)) {
          changeData(gameId, { finished: ts })
          _dataChange()
        }
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
            setTilesZIndex(gameId, tileIdxs, zIndex)
            _tileChanges(tileIdxs)
            if (getScoreMode(gameId) === SCORE_MODE_ANY) {
              changePlayer(gameId, playerId, {
                points: getPlayerPoints(gameId, playerId) + 1,
              })
              _playerChange()
            }
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
    evtInfo._last_mouse = pos
  } else {
    changePlayer(gameId, playerId, { ts })
    _playerChange()
  }

  setEvtInfo(gameId, playerId, evtInfo)
  return changes
}

export default {
  __createPlayerObject,
  setGame,
  exists,
  playerExists,
  getRelevantPlayers,
  getActivePlayers,
  addPlayer,
  getFinishedTileCount,
  getTileCount,
  getImageUrl,
  setImageUrl,
  get,
  getAllGames,
  getPlayerBgColor,
  getPlayerColor,
  getPlayerName,
  getPlayerIndexById,
  getPlayerIdByIndex,
  changePlayer,
  setPlayer,
  setTile,
  setPuzzleData,
  getTableWidth,
  getTableHeight,
  getPuzzle,
  getRng,
  getPuzzleWidth,
  getPuzzleHeight,
  getTilesSortedByZIndex,
  getFirstOwnedTile,
  getTileDrawOffset,
  getTileDrawSize,
  getFinalTilePos,
  getStartTs,
  getFinishTs,
  handleInput,
  SCORE_MODE_FINAL,
  SCORE_MODE_ANY,
}
