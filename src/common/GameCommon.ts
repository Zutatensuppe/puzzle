import Geometry, { Point, Rect } from './Geometry'
import Protocol from './Protocol'
import { Rng } from './Rng'
import Time from './Time'
import Util from './Util'

export type EncodedPlayer = Array<any>
export type EncodedPiece = Array<any>
export type EncodedPieceShape = number

interface GameRng {
  obj: Rng
  type?: string
}

interface Game {
  id: string
  players: Array<EncodedPlayer>
  puzzle: Puzzle
  evtInfos: Record<string, EvtInfo>
  scoreMode?: ScoreMode
  rng: GameRng
}

export interface Puzzle {
  tiles: Array<EncodedPiece>
  data: PuzzleData
  info: PuzzleInfo
}

interface PuzzleData {
  started: number
  finished: number
  maxGroup: number
  maxZ: number
}

interface PuzzleTable {
  width: number
  height: number
}

enum PieceEdge {
  Flat = 0,
  Out = 1,
  In = -1,
}
export interface PieceShape {
  top: PieceEdge
  bottom: PieceEdge
  left: PieceEdge
  right: PieceEdge
}

export interface Piece {
  owner: string|number
  idx: number
  pos: Point
  z: number
  group: number
}

export interface PuzzleInfo {
  table: PuzzleTable
  targetTiles: number,
  imageUrl: string

  width: number
  height: number
  tileSize: number
  tileDrawSize: number
  tileMarginWidth: number
  tileDrawOffset: number
  snapDistance: number

  tiles: number
  tilesX: number
  tilesY: number

  shapes: Array<EncodedPieceShape>
}

export interface Player {
  id: string
  x: number
  y: number
  d: 0|1
  name: string|null
  color: string|null
  bgcolor: string|null
  points: number
  ts: number
}

interface EvtInfo {
  _last_mouse: Point|null
  _last_mouse_down: Point|null
}

export enum ScoreMode {
  FINAL = 0,
  ANY = 1,
}

const IDLE_TIMEOUT_SEC = 30

// Map<gameId, Game>
const GAMES: Record<string, Game> = {}

function exists(gameId: string) {
  return (!!GAMES[gameId]) || false
}

function __createPlayerObject(id: string, ts: number): Player {
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

function setGame(gameId: string, game: Game) {
  GAMES[gameId] = game
}

function getPlayerIndexById(gameId: string, playerId: string): number {
  let i = 0;
  for (let player of GAMES[gameId].players) {
    if (Util.decodePlayer(player).id === playerId) {
      return i
    }
    i++
  }
  return -1
}

function getPlayerIdByIndex(gameId: string, playerIndex: number): string|null {
  if (GAMES[gameId].players.length > playerIndex) {
    return Util.decodePlayer(GAMES[gameId].players[playerIndex]).id
  }
  return null
}

function getPlayer(gameId: string, playerId: string): Player {
  const idx = getPlayerIndexById(gameId, playerId)
  return Util.decodePlayer(GAMES[gameId].players[idx])
}

function setPlayer(gameId: string, playerId: string, player: Player) {
  const idx = getPlayerIndexById(gameId, playerId)
  if (idx === -1) {
    GAMES[gameId].players.push(Util.encodePlayer(player))
  } else {
    GAMES[gameId].players[idx] = Util.encodePlayer(player)
  }
}

function setTile(gameId: string, tileIdx: number, tile: Piece) {
  GAMES[gameId].puzzle.tiles[tileIdx] = Util.encodeTile(tile)
}

function setPuzzleData(gameId: string, data: PuzzleData) {
  GAMES[gameId].puzzle.data = data
}

function playerExists(gameId: string, playerId: string) {
  const idx = getPlayerIndexById(gameId, playerId)
  return idx !== -1
}

function getActivePlayers(gameId: string, ts: number): Array<Player> {
  const minTs = ts - IDLE_TIMEOUT_SEC * Time.SEC
  return getAllPlayers(gameId).filter((p: Player) => p.ts >= minTs)
}

function getIdlePlayers(gameId: string, ts: number): Array<Player> {
  const minTs = ts - IDLE_TIMEOUT_SEC * Time.SEC
  return getAllPlayers(gameId).filter((p: Player) => p.ts < minTs && p.points > 0)
}

function addPlayer(gameId: string, playerId: string, ts: number): void {
  if (!playerExists(gameId, playerId)) {
    setPlayer(gameId, playerId, __createPlayerObject(playerId, ts))
  } else {
    changePlayer(gameId, playerId, { ts })
  }
}

function getEvtInfo(gameId: string, playerId: string): EvtInfo {
  if (playerId in GAMES[gameId].evtInfos) {
    return GAMES[gameId].evtInfos[playerId]
  }
  return {
    _last_mouse: null,
    _last_mouse_down: null,
  }
}

function setEvtInfo(gameId: string, playerId: string, evtInfo: EvtInfo) {
  GAMES[gameId].evtInfos[playerId] = evtInfo
}

function getAllGames(): Array<Game> {
  return Object.values(GAMES).sort((a: Game, b: Game) => {
    // when both have same finished state, sort by started
    if (isFinished(a.id) === isFinished(b.id)) {
      return b.puzzle.data.started - a.puzzle.data.started
    }
    // otherwise, sort: unfinished, finished
    return isFinished(a.id) ? 1 : -1
  })
}

function getAllPlayers(gameId: string): Array<Player> {
  return GAMES[gameId]
    ? GAMES[gameId].players.map(Util.decodePlayer)
    : []
}

function get(gameId: string) {
  return GAMES[gameId]
}

function getTileCount(gameId: string): number {
  return GAMES[gameId].puzzle.tiles.length
}

function getImageUrl(gameId: string): string {
  return GAMES[gameId].puzzle.info.imageUrl
}

function setImageUrl(gameId: string, imageUrl: string) {
  GAMES[gameId].puzzle.info.imageUrl = imageUrl
}

function getScoreMode(gameId: string): ScoreMode {
  return GAMES[gameId].scoreMode || ScoreMode.FINAL
}

function isFinished(gameId: string) {
  return getFinishedTileCount(gameId) === getTileCount(gameId)
}

function getFinishedTileCount(gameId: string) {
  let count = 0
  for (let t of GAMES[gameId].puzzle.tiles) {
    if (Util.decodeTile(t).owner === -1) {
      count++
    }
  }
  return count
}

function getTilesSortedByZIndex(gameId: string) {
  const tiles = GAMES[gameId].puzzle.tiles.map(Util.decodeTile)
  return tiles.sort((t1, t2) => t1.z - t2.z)
}

function changePlayer(gameId: string, playerId: string, change: any) {
  const player = getPlayer(gameId, playerId)
  for (let k of Object.keys(change)) {
    // @ts-ignore
    player[k] = change[k]
  }
  setPlayer(gameId, playerId, player)
}

function changeData(gameId: string, change: any) {
  for (let k of Object.keys(change)) {
    // @ts-ignore
    GAMES[gameId].puzzle.data[k] = change[k]
  }
}

function changeTile(gameId: string, tileIdx: number, change: any) {
  for (let k of Object.keys(change)) {
    const tile = Util.decodeTile(GAMES[gameId].puzzle.tiles[tileIdx])
    // @ts-ignore
    tile[k] = change[k]
    GAMES[gameId].puzzle.tiles[tileIdx] = Util.encodeTile(tile)
  }
}

const getTile = (gameId: string, tileIdx: number): Piece => {
  return Util.decodeTile(GAMES[gameId].puzzle.tiles[tileIdx])
}

const getTileGroup = (gameId: string, tileIdx: number) => {
  const tile = getTile(gameId, tileIdx)
  return tile.group
}

const getFinalTilePos = (gameId: string, tileIdx: number) => {
  const info = GAMES[gameId].puzzle.info
  const boardPos = {
    x: (info.table.width - info.width) / 2,
    y: (info.table.height - info.height) / 2
  }
  const srcPos = srcPosByTileIdx(gameId, tileIdx)
  return Geometry.pointAdd(boardPos, srcPos)
}

const getTilePos = (gameId: string, tileIdx: number) => {
  const tile = getTile(gameId, tileIdx)
  return tile.pos
}

// todo: instead, just make the table bigger and use that :)
const getBounds = (gameId: string) => {
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

const getTileBounds = (gameId: string, tileIdx: number) => {
  const s = getTileSize(gameId)
  const tile = getTile(gameId, tileIdx)
  return {
    x: tile.pos.x,
    y: tile.pos.y,
    w: s,
    h: s,
  }
}

const getTileZIndex = (gameId: string, tileIdx: number) => {
  const tile = getTile(gameId, tileIdx)
  return tile.z
}

const getFirstOwnedTileIdx = (gameId: string, playerId: string) => {
  for (let t of GAMES[gameId].puzzle.tiles) {
    const tile = Util.decodeTile(t)
    if (tile.owner === playerId) {
      return tile.idx
    }
  }
  return -1
}

const getFirstOwnedTile = (gameId: string, playerId: string) => {
  const idx = getFirstOwnedTileIdx(gameId, playerId)
  return idx < 0 ? null : GAMES[gameId].puzzle.tiles[idx]
}

const getTileDrawOffset = (gameId: string) => {
  return GAMES[gameId].puzzle.info.tileDrawOffset
}

const getTileDrawSize = (gameId: string) => {
  return GAMES[gameId].puzzle.info.tileDrawSize
}

const getTileSize = (gameId: string) => {
  return GAMES[gameId].puzzle.info.tileSize
}

const getStartTs = (gameId: string) => {
  return GAMES[gameId].puzzle.data.started
}

const getFinishTs = (gameId: string) => {
  return GAMES[gameId].puzzle.data.finished
}

const getMaxGroup = (gameId: string) => {
  return GAMES[gameId].puzzle.data.maxGroup
}

const getMaxZIndex = (gameId: string) => {
  return GAMES[gameId].puzzle.data.maxZ
}

const getMaxZIndexByTileIdxs = (gameId: string, tileIdxs: Array<number>) => {
  let maxZ = 0
  for (let tileIdx of tileIdxs) {
    let tileZIndex = getTileZIndex(gameId, tileIdx)
    if (tileZIndex > maxZ) {
      maxZ = tileZIndex
    }
  }
  return maxZ
}

function srcPosByTileIdx(gameId: string, tileIdx: number) {
  const info = GAMES[gameId].puzzle.info

  const c = Util.coordByTileIdx(info, tileIdx)
  const cx = c.x * info.tileSize
  const cy = c.y * info.tileSize

  return { x: cx, y: cy }
}

function getSurroundingTilesByIdx(gameId: string, tileIdx: number) {
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

const setTilesZIndex = (gameId: string, tileIdxs: Array<number>, zIndex: number) => {
  for (let tilesIdx of tileIdxs) {
    changeTile(gameId, tilesIdx, { z: zIndex })
  }
}

const moveTileDiff = (gameId: string, tileIdx: number, diff: Point) => {
  const oldPos = getTilePos(gameId, tileIdx)
  const pos = Geometry.pointAdd(oldPos, diff)
  changeTile(gameId, tileIdx, { pos })
}

const moveTilesDiff = (gameId: string, tileIdxs: Array<number>, diff: Point) => {
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

const finishTiles = (gameId: string, tileIdxs: Array<number>) => {
  for (let tileIdx of tileIdxs) {
    changeTile(gameId, tileIdx, { owner: -1, z: 1 })
  }
}

const setTilesOwner = (
  gameId: string,
  tileIdxs: Array<number>,
  owner: string|number
) => {
  for (let tileIdx of tileIdxs) {
    changeTile(gameId, tileIdx, { owner })
  }
}

// get all grouped tiles for a tile
function getGroupedTileIdxs(gameId: string, tileIdx: number) {
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
const freeTileIdxByPos = (gameId: string, pos: Point) => {
  let info = GAMES[gameId].puzzle.info
  let tiles = GAMES[gameId].puzzle.tiles

  let maxZ = -1
  let tileIdx = -1
  for (let idx = 0; idx < tiles.length; idx++) {
    const tile = Util.decodeTile(tiles[idx])
    if (tile.owner !== 0) {
      continue
    }

    const collisionRect: Rect = {
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

const getPlayerBgColor = (gameId: string, playerId: string) => {
  const p = getPlayer(gameId, playerId)
  return p ? p.bgcolor : null
}

const getPlayerColor = (gameId: string, playerId: string) => {
  const p = getPlayer(gameId, playerId)
  return p ? p.color : null
}

const getPlayerName = (gameId: string, playerId: string) => {
  const p = getPlayer(gameId, playerId)
  return p ? p.name : null
}

const getPlayerPoints = (gameId: string, playerId: string): number => {
  const p = getPlayer(gameId, playerId)
  return p ? p.points : 0
}

// determine if two tiles are grouped together
const areGrouped = (gameId: string, tileIdx1: number, tileIdx2: number) => {
  const g1 = getTileGroup(gameId, tileIdx1)
  const g2 = getTileGroup(gameId, tileIdx2)
  return g1 && g1 === g2
}

const getTableWidth = (gameId: string) => {
  return GAMES[gameId].puzzle.info.table.width
}

const getTableHeight = (gameId: string) => {
  return GAMES[gameId].puzzle.info.table.height
}

const getPuzzle = (gameId: string) => {
  return GAMES[gameId].puzzle
}

const getRng = (gameId: string): Rng => {
  return GAMES[gameId].rng.obj
}

const getPuzzleWidth = (gameId: string) => {
  return GAMES[gameId].puzzle.info.width
}

const getPuzzleHeight = (gameId: string) => {
  return GAMES[gameId].puzzle.info.height
}

function handleInput(gameId: string, playerId: string, input: any, ts: number) {
  const puzzle = GAMES[gameId].puzzle
  const evtInfo = getEvtInfo(gameId, playerId)

  const changes = [] as Array<Array<any>>

  const _dataChange = () => {
    changes.push([Protocol.CHANGE_DATA, puzzle.data])
  }

  const _tileChange = (tileIdx: number) => {
    changes.push([
      Protocol.CHANGE_TILE,
      Util.encodeTile(getTile(gameId, tileIdx)),
    ])
  }

  const _tileChanges = (tileIdxs: Array<number>) => {
    for (const tileIdx of tileIdxs) {
      _tileChange(tileIdx)
    }
  }

  const _playerChange = () => {
    changes.push([
      Protocol.CHANGE_PLAYER,
      Util.encodePlayer(getPlayer(gameId, playerId)),
    ])
  }

  // put both tiles (and their grouped tiles) in the same group
  const groupTiles = (gameId: string, tileIdx1: number, tileIdx2: number) => {
    const tiles = GAMES[gameId].puzzle.tiles
    const group1 = getTileGroup(gameId, tileIdx1)
    const group2 = getTileGroup(gameId, tileIdx2)

    let group
    const searchGroups = []
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
      const maxGroup = getMaxGroup(gameId) + 1
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
      for (const t of tiles) {
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
    const d = 0

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

        let points = getPlayerPoints(gameId, playerId)
        if (getScoreMode(gameId) === ScoreMode.FINAL) {
          points += tileIdxs.length
        } else if (getScoreMode(gameId) === ScoreMode.ANY) {
          points += 1
        } else {
          // no score mode... should never occur, because there is a
          // fallback to ScoreMode.FINAL in getScoreMode function
        }
        changePlayer(gameId, playerId, { d, ts, points })
        _playerChange()

        // check if the puzzle is finished
        if (getFinishedTileCount(gameId) === getTileCount(gameId)) {
          changeData(gameId, { finished: ts })
          _dataChange()
        }
      } else {
        // Snap to other tiles
        const check = (
          gameId: string,
          tileIdx: number,
          otherTileIdx: number,
          off: Array<number>
        ) => {
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
            return true
          }
          return false
        }

        let snapped = false
        for (let tileIdxTmp of getGroupedTileIdxs(gameId, tileIdx)) {
          let othersIdxs = getSurroundingTilesByIdx(gameId, tileIdxTmp)
          if (
            check(gameId, tileIdxTmp, othersIdxs[0], [0, 1]) // top
            || check(gameId, tileIdxTmp, othersIdxs[1], [-1, 0]) // right
            || check(gameId, tileIdxTmp, othersIdxs[2], [0, -1]) // bottom
            || check(gameId, tileIdxTmp, othersIdxs[3], [1, 0]) // left
          ) {
            snapped = true
            break
          }
        }
        if (snapped && getScoreMode(gameId) === ScoreMode.ANY) {
          const points = getPlayerPoints(gameId, playerId) + 1
          changePlayer(gameId, playerId, { d, ts, points })
          _playerChange()
        } else {
          changePlayer(gameId, playerId, { d, ts })
          _playerChange()
        }
      }
    } else {
      changePlayer(gameId, playerId, { d, ts })
      _playerChange()
    }
    evtInfo._last_mouse = pos
  } else if (type === Protocol.INPUT_EV_ZOOM_IN) {
    const x = input[1]
    const y = input[2]
    changePlayer(gameId, playerId, { x, y, ts })
    _playerChange()
    evtInfo._last_mouse = { x, y }
  } else if (type === Protocol.INPUT_EV_ZOOM_OUT) {
    const x = input[1]
    const y = input[2]
    changePlayer(gameId, playerId, { x, y, ts })
    _playerChange()
    evtInfo._last_mouse = { x, y }
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
  getActivePlayers,
  getIdlePlayers,
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
}
