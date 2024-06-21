import Geometry, { Dim, Point, Rect } from './Geometry'
import { cropUrl } from './ImageService'
import { CHANGE_TYPE, GAME_EVENT_TYPE, LOG_TYPE } from './Protocol'
import { Rng } from './Rng'
import Time from './Time'
import {
  Change,
  ClientId,
  EncodedPiece,
  Game,
  GameEvent,
  GameId,
  HandleGameEventResult,
  ImageInfo,
  LogEntry,
  Piece,
  PieceChange,
  Player,
  PlayerChange,
  Puzzle,
  PuzzleData,
  PuzzleDataChange,
  RegisteredMap,
  ScoreMode,
  ShapeMode,
  SnapMode,
  Timestamp,
} from './Types'
import Util from './Util'

export const NEWGAME_MIN_PIECES = 10
export const NEWGAME_MAX_PIECES = 5000

const IDLE_TIMEOUT_SEC = 30

// Map<gameId, Game>
const GAMES: Record<GameId, Game> = {}

function loaded(gameId: GameId): boolean {
  return (!!GAMES[gameId]) || false
}

function __createPlayerObject(id: ClientId, ts: Timestamp): Player {
  return {
    id: id,
    x: 0,
    y: 0,
    d: 0, // mouse down
    name: null, // 'anon'
    color: null, // '#ffffff'
    bgcolor: null, // '#222222'
    points: 0,
    ts,
  }
}

function setGame(gameId: GameId, game: Game): void {
  GAMES[gameId] = game
}

const GAME_LOADING: Record<string, boolean> = {}
type CALLBACK_FN = (loaded: boolean) => void
const CALLBACKS: Record<string, CALLBACK_FN[]> = {}
function onGameLoadingStateChange(gameId: GameId, callback: (loaded: boolean) => void) {
  CALLBACKS[gameId] = CALLBACKS[gameId] || []
  CALLBACKS[gameId].push(callback)
}

function setGameLoading(gameId: GameId, loading: boolean): void {
  if (loading) {
    GAME_LOADING[gameId] = true
    return
  }

  delete GAME_LOADING[gameId]
  if (CALLBACKS[gameId]) {
    const isLoaded = loaded(gameId)
    for (const cb of CALLBACKS[gameId]) {
      cb(isLoaded)
    }
    delete CALLBACKS[gameId]
  }
}

function isGameLoading(gameId: GameId): boolean {
  return !!GAME_LOADING[gameId]
}

function setRegisteredMap(gameId: GameId, registeredMap: RegisteredMap): void {
  GAMES[gameId].registeredMap = registeredMap
}

function unsetGame(gameId: GameId): void {
  delete GAMES[gameId]
}

function getPlayerIndexById(gameId: GameId, clientId: ClientId): number {
  let i = 0
  for (const player of GAMES[gameId].players) {
    if (Util.decodePlayer(player).id === clientId) {
      return i
    }
    i++
  }
  return -1
}

function getPlayerIdByIndex(gameId: GameId, playerIndex: number): ClientId | null {
  if (GAMES[gameId].players.length > playerIndex) {
    return Util.decodePlayer(GAMES[gameId].players[playerIndex]).id
  }
  return null
}

function getPlayer(gameId: GameId, clientId: ClientId): Player | null {
  const idx = getPlayerIndexById(gameId, clientId)
  if (idx === -1) {
    return null
  }
  return Util.decodePlayer(GAMES[gameId].players[idx])
}

function setPlayer(
  gameId: GameId,
  clientId: ClientId,
  player: Player,
): void {
  const idx = getPlayerIndexById(gameId, clientId)
  if (idx === -1) {
    GAMES[gameId].players.push(Util.encodePlayer(player))
  } else {
    GAMES[gameId].players[idx] = Util.encodePlayer(player)
  }
}

function setPiece(gameId: GameId, pieceIdx: number, piece: Piece): void {
  GAMES[gameId].puzzle.tiles[pieceIdx] = Util.encodePiece(piece)
}

function setPuzzleData(gameId: GameId, data: PuzzleData): void {
  GAMES[gameId].puzzle.data = data
}

function playerExists(gameId: GameId, clientId: ClientId): boolean {
  const idx = getPlayerIndexById(gameId, clientId)
  return idx !== -1
}

function getActivePlayers(gameId: GameId, ts: number): Player[] {
  return Game_getActivePlayers(GAMES[gameId], ts)
}

function getIdlePlayers(gameId: GameId, ts: number): Player[] {
  return Game_getIdlePlayers(GAMES[gameId], ts)
}

function getRegisteredMap(gameId: GameId): RegisteredMap {
  return Game_getRegisteredMap(GAMES[gameId])
}

function addPlayer(
  gameId: GameId,
  clientId: ClientId,
  ts: Timestamp,
): void {
  if (!playerExists(gameId, clientId)) {
    setPlayer(gameId, clientId, __createPlayerObject(clientId, ts))
  } else {
    changePlayer(gameId, clientId, { ts })
  }
}

function get(gameId: GameId): Game | null {
  return GAMES[gameId] || null
}

function getPieceCount(gameId: GameId): number {
  return Game_getPieceCount(GAMES[gameId])
}

function getImageUrl(gameId: GameId): string {
  return Game_getImageUrl(GAMES[gameId])
}

function getScoreMode(gameId: GameId): ScoreMode {
  return Game_getScoreMode(GAMES[gameId])
}

function getSnapMode(gameId: GameId): SnapMode {
  return Game_getSnapMode(GAMES[gameId])
}

function getShapeMode(gameId: GameId): ShapeMode {
  return Game_getShapeMode(GAMES[gameId])
}

function getVersion(gameId: GameId): number {
  return Game_getVersion(GAMES[gameId])
}

function getFinishedPiecesCount(gameId: GameId): number {
  return Game_getFinishedPiecesCount(GAMES[gameId])
}

function getPiecesSortedByZIndex(gameId: GameId): Piece[] {
  return Game_getPiecesSortedByZIndex(GAMES[gameId])
}

function changePlayer(
  gameId: GameId,
  clientId: ClientId,
  change: PlayerChange,
): void {
  const player = getPlayer(gameId, clientId)
  if (player === null) {
    return
  }

  for (const k of Object.keys(change)) {
    // @ts-ignore
    player[k] = change[k]
  }
  setPlayer(gameId, clientId, player)
}

function changeData(gameId: GameId, change: PuzzleDataChange): void {
  for (const k of Object.keys(change)) {
    // @ts-ignore
    GAMES[gameId].puzzle.data[k] = change[k]
  }
}

function changePiece(
  gameId: GameId,
  pieceIdx: number,
  change: PieceChange,
): void {
  for (const k of Object.keys(change)) {
    const piece = Util.decodePiece(GAMES[gameId].puzzle.tiles[pieceIdx])
    // @ts-ignore
    piece[k] = change[k]
    GAMES[gameId].puzzle.tiles[pieceIdx] = Util.encodePiece(piece)
  }
}

const getPiece = (gameId: GameId, pieceIdx: number): Piece => {
  return Util.decodePiece(GAMES[gameId].puzzle.tiles[pieceIdx])
}

const getPieceGroup = (gameId: GameId, pieceIdx: number): number => {
  const piece = getPiece(gameId, pieceIdx)
  return piece.group
}

const isCornerPiece = (gameId: GameId, pieceIdx: number): boolean => {
  const info = GAMES[gameId].puzzle.info
  return (
    pieceIdx === 0 // top left corner
    || pieceIdx === (info.tilesX - 1) // top right corner
    || pieceIdx === (info.tiles - info.tilesX) // bottom left corner
    || pieceIdx === (info.tiles - 1) // bottom right corner
  )
}

const getFinalPiecePos = (gameId: GameId, pieceIdx: number): Point => {
  const info = GAMES[gameId].puzzle.info
  const boardPos = {
    x: (info.table.width - info.width) / 2,
    y: (info.table.height - info.height) / 2,
  }
  const srcPos = srcPosByPieceIdx(gameId, pieceIdx)
  return Geometry.pointAdd(boardPos, srcPos)
}

const getPiecePos = (gameId: GameId, pieceIdx: number): Point => {
  const piece = getPiece(gameId, pieceIdx)
  return piece.pos
}

// TODO: instead, just make the table bigger and use that :)
const getBounds = (gameId: GameId): Rect => {
  return Game_getBounds(GAMES[gameId])
}

const Game_getBounds_v4 = (game: Game): Rect => {
  return { x: 0, y: 0, w: Game_getTableWidth(game), h: Game_getTableHeight(game) }
}

const Game_getBounds_v3 = (game: Game): Rect => {
  const tw = Game_getTableWidth(game)
  const th = Game_getTableHeight(game)

  const overX = Math.round(tw / 4)
  const overY = Math.round(th / 4)
  return {
    x: 0 - overX,
    y: 0 - overY,
    w: tw + 2 * overX,
    h: th + 2 * overY,
  }
}

const getPiecesBounds = (gameId: GameId): Rect => {
  if (GAMES[gameId].puzzle.tiles.length === 0) {
    throw new Error('[2023-11-29] no pieces in puzzle')
  }

  let piece: Piece = Util.decodePiece(GAMES[gameId].puzzle.tiles[0])

  let minX = piece.pos.x
  let minY = piece.pos.y
  let maxX = piece.pos.x
  let maxY = piece.pos.y
  for (let i = 1; i < GAMES[gameId].puzzle.tiles.length; i++) {
    piece = Util.decodePiece(GAMES[gameId].puzzle.tiles[i])
    if (piece.pos.x < minX) minX = piece.pos.x
    if (piece.pos.x > maxX) maxX = piece.pos.x
    if (piece.pos.y < minY) minY = piece.pos.y
    if (piece.pos.y > maxY) maxY = piece.pos.y
  }
  const drawOffset = getPieceDrawOffset(gameId)
  const drawSize = getPieceDrawSize(gameId)
  return {
    x: minX + drawOffset,
    y: minY + drawOffset,
    w: maxX - minX + drawSize,
    h: maxY - minY + drawSize,
  }
}

const getPieceZIndex = (gameId: GameId, pieceIdx: number): number => {
  return getPiece(gameId, pieceIdx).z
}

const getFirstOwnedPieceIdx = (gameId: GameId, clientId: ClientId): number => {
  for (const t of GAMES[gameId].puzzle.tiles) {
    const piece = Util.decodePiece(t)
    if (piece.owner === clientId) {
      return piece.idx
    }
  }
  return -1
}

const getFirstOwnedPiece = (
  gameId: GameId,
  playerId: ClientId,
): EncodedPiece | null => {
  const idx = getFirstOwnedPieceIdx(gameId, playerId)
  return idx < 0 ? null : GAMES[gameId].puzzle.tiles[idx]
}

const getPieceDrawOffset = (gameId: GameId): number => {
  return Game_getPieceDrawOffset(GAMES[gameId])
}

const getPieceDrawSize = (gameId: GameId): number => {
  return Game_getPieceDrawSize(GAMES[gameId])
}

const getStartTs = (gameId: GameId): Timestamp => {
  return Game_getStartTs(GAMES[gameId])
}

const getFinishTs = (gameId: GameId): Timestamp => {
  return Game_getFinishTs(GAMES[gameId])
}

const getMaxGroup = (gameId: GameId): number => {
  return GAMES[gameId].puzzle.data.maxGroup
}

const getMaxZIndex = (gameId: GameId): number => {
  return GAMES[gameId].puzzle.data.maxZ
}

const getMaxZIndexByPieceIdxs = (gameId: GameId, pieceIdxs: Array<number>): number => {
  let maxZ = 0
  for (const pieceIdx of pieceIdxs) {
    const curZ = getPieceZIndex(gameId, pieceIdx)
    if (curZ > maxZ) {
      maxZ = curZ
    }
  }
  return maxZ
}

function srcPosByPieceIdx(gameId: GameId, pieceIdx: number): Point {
  const info = GAMES[gameId].puzzle.info

  const c = Util.coordByPieceIdxDeprecated(info, pieceIdx)
  const cx = c.x * info.tileSize
  const cy = c.y * info.tileSize

  return { x: cx, y: cy }
}

function getSurroundingPiecesByIdx(gameId: GameId, pieceIdx: number) {
  const info = GAMES[gameId].puzzle.info

  const c = Util.coordByPieceIdxDeprecated(info, pieceIdx)

  return [
    // top
    (c.y > 0) ? (pieceIdx - info.tilesX) : -1,
    // right
    (c.x < info.tilesX - 1) ? (pieceIdx + 1) : -1,
    // bottom
    (c.y < info.tilesY - 1) ? (pieceIdx + info.tilesX) : -1,
    // left
    (c.x > 0) ? (pieceIdx - 1) : -1,
  ]
}

const setPiecesZIndex = (gameId: GameId, pieceIdxs: Array<number>, zIndex: number): void => {
  for (const pieceIdx of pieceIdxs) {
    changePiece(gameId, pieceIdx, { z: zIndex })
  }
}

const movePieceDiff = (gameId: GameId, pieceIdx: number, diff: Point): void => {
  const oldPos = getPiecePos(gameId, pieceIdx)
  const pos = Geometry.pointAdd(oldPos, diff)
  changePiece(gameId, pieceIdx, { pos })
}

const movePiecesDiff = (
  gameId: GameId,
  pieceIdxs: Array<number>,
  diff: Point,
): boolean => {
  const gameVersion = getVersion(gameId)
  if (gameVersion >= 3) {
    return movePiecesDiff_v3(gameId, pieceIdxs, diff)
  }
  return movePiecesDiff_v2(gameId, pieceIdxs, diff)
}

const movePiecesDiff_v2 = (
  gameId: GameId,
  pieceIdxs: Array<number>,
  diff: Point,
): boolean => {
  const drawSize = getPieceDrawSize(gameId)
  const bounds = getBounds(gameId)
  const cappedDiff = diff

  for (const pieceIdx of pieceIdxs) {
    const t = getPiece(gameId, pieceIdx)
    if (t.pos.x + diff.x < bounds.x) {
      cappedDiff.x = Math.max(bounds.x - t.pos.x, cappedDiff.x)
    } else if (t.pos.x + drawSize + diff.x > bounds.x + bounds.w) {
      cappedDiff.x = Math.min(bounds.x + bounds.w - t.pos.x + drawSize, cappedDiff.x)
    }
    if (t.pos.y + diff.y < bounds.y) {
      cappedDiff.y = Math.max(bounds.y - t.pos.y, cappedDiff.y)
    } else if (t.pos.y + drawSize + diff.y > bounds.y + bounds.h) {
      cappedDiff.y = Math.min(bounds.y + bounds.h - t.pos.y + drawSize, cappedDiff.y)
    }
  }
  if (!cappedDiff.x && !cappedDiff.y) {
    return false
  }

  for (const pieceIdx of pieceIdxs) {
    movePieceDiff(gameId, pieceIdx, cappedDiff)
  }
  return true
}

const movePiecesDiff_v3 = (
  gameId: GameId,
  pieceIdxs: Array<number>,
  diff: Point,
): boolean => {
  const bounds = getBounds(gameId)
  const off = getPieceDrawSize(gameId) + (2 * getPieceDrawOffset(gameId))
  const minX = bounds.x
  const minY = bounds.y
  const maxX = minX + bounds.w - off
  const maxY = minY + bounds.h - off

  const cappedDiff = diff
  for (const pieceIdx of pieceIdxs) {
    const t = getPiece(gameId, pieceIdx)
    if (diff.x < 0) {
      cappedDiff.x = Math.max(minX - t.pos.x, cappedDiff.x)
    } else {
      cappedDiff.x = Math.min(maxX - t.pos.x, cappedDiff.x)
    }
    if (diff.y < 0) {
      cappedDiff.y = Math.max(minY - t.pos.y, cappedDiff.y)
    } else {
      cappedDiff.y = Math.min(maxY - t.pos.y, cappedDiff.y)
    }
  }
  if (!cappedDiff.x && !cappedDiff.y) {
    return false
  }

  for (const pieceIdx of pieceIdxs) {
    movePieceDiff(gameId, pieceIdx, cappedDiff)
  }
  return true
}

const isFinishedPiece = (gameId: GameId, pieceIdx: number): boolean => {
  return getPieceOwner(gameId, pieceIdx) === -1
}

const getPieceOwner = (gameId: GameId, pieceIdx: number): string | number => {
  return getPiece(gameId, pieceIdx).owner
}

const finishPieces = (gameId: GameId, pieceIdxs: Array<number>): void => {
  for (const pieceIdx of pieceIdxs) {
    changePiece(gameId, pieceIdx, { owner: -1, z: 1 })
  }
}

const setPiecesOwner = (
  gameId: GameId,
  pieceIdxs: Array<number>,
  owner: ClientId | number,
): void => {
  for (const pieceIdx of pieceIdxs) {
    changePiece(gameId, pieceIdx, { owner })
  }
}

// returns the count of pieces in the same group as
// the piece identified by pieceIdx
function getGroupedPieceCount(gameId: GameId, pieceIdx: number): number {
  return getGroupedPieceIdxs(gameId, pieceIdx).length
}

// get all grouped pieces for a piece
function getGroupedPieceIdxs(gameId: GameId, pieceIdx: number): number[] {
  const pieces = GAMES[gameId].puzzle.tiles
  const piece = Util.decodePiece(pieces[pieceIdx])

  const grouped: number[] = []
  if (piece.group) {
    for (const other of pieces) {
      const otherPiece = Util.decodePiece(other)
      if (otherPiece.group === piece.group) {
        grouped.push(otherPiece.idx)
      }
    }
  } else {
    grouped.push(piece.idx)
  }
  return grouped
}

// Returns the index of the puzzle piece with the highest z index
// that is not finished yet and that matches the position
const freePieceIdxByPos = (gameId: GameId, pos: Point): number => {
  const info = GAMES[gameId].puzzle.info
  const pieces = GAMES[gameId].puzzle.tiles

  let maxZ = -1
  let pieceIdx = -1
  for (let idx = 0; idx < pieces.length; idx++) {
    const piece = Util.decodePiece(pieces[idx])
    if (piece.owner !== 0) {
      continue
    }

    const collisionRect: Rect = {
      x: piece.pos.x,
      y: piece.pos.y,
      w: info.tileSize,
      h: info.tileSize,
    }
    if (Geometry.pointInBounds(pos, collisionRect)) {
      if (maxZ === -1 || piece.z > maxZ) {
        maxZ = piece.z
        pieceIdx = idx
      }
    }
  }
  return pieceIdx
}

const getPlayerBgColor = (gameId: GameId, clientId: ClientId): string | null => {
  const p = getPlayer(gameId, clientId)
  return p ? p.bgcolor : null
}

const getPlayerColor = (gameId: GameId, clientId: ClientId): string | null => {
  const p = getPlayer(gameId, clientId)
  return p ? p.color : null
}

const getPlayerName = (gameId: GameId, clientId: ClientId): string | null => {
  const p = getPlayer(gameId, clientId)
  return p ? p.name : null
}

const getPlayerPoints = (gameId: GameId, clientId: ClientId): number => {
  const p = getPlayer(gameId, clientId)
  return p ? p.points : 0
}

// determine if two pieces are grouped together
const areGrouped = (
  gameId: GameId,
  pieceIdx1: number,
  pieceIdx2: number,
): boolean => {
  const g1 = getPieceGroup(gameId, pieceIdx1)
  const g2 = getPieceGroup(gameId, pieceIdx2)
  return !!(g1 && g1 === g2)
}

const getTableWidth = (gameId: GameId): number => {
  return Game_getTableWidth(GAMES[gameId])
}

const getTableHeight = (gameId: GameId): number => {
  return Game_getTableHeight(GAMES[gameId])
}

const getTableDim = (gameId: GameId): Dim => {
  return Game_getTableDim(GAMES[gameId])
}

const getBoardDim = (gameId: GameId): Dim => {
  return Game_getBoardDim(GAMES[gameId])
}

const getPieceDim = (gameId: GameId): Dim => {
  return Game_getPieceDim(GAMES[gameId])
}

const getBoardPos = (gameId: GameId): Point => {
  return Game_getBoardPos(GAMES[gameId])
}

const getPuzzle = (gameId: GameId): Puzzle => {
  return Game_getPuzzle(GAMES[gameId])
}

const getRng = (gameId: GameId): Rng => {
  return GAMES[gameId].rng.obj
}

const getPuzzleWidth = (gameId: GameId): number => {
  return GAMES[gameId].puzzle.info.width
}

const getPuzzleHeight = (gameId: GameId): number => {
  return GAMES[gameId].puzzle.info.height
}

const maySnapToFinal = (gameId: GameId, pieceIdxs: number[]): boolean => {
  if (getSnapMode(gameId) === SnapMode.REAL) {
    // only can snap to final if any of the grouped pieces are
    // corner pieces
    for (const pieceIdx of pieceIdxs) {
      if (isCornerPiece(gameId, pieceIdx)) {
        return true
      }
    }
    return false
  }

  // in other modes can always snap
  return true
}

function handleGameEvent(
  gameId: GameId,
  clientId: ClientId,
  gameEvent: GameEvent,
  ts: Timestamp,
): HandleGameEventResult {
  const puzzle = GAMES[gameId].puzzle

  const changes: Array<Change> = []

  const _dataChange = (): void => {
    changes.push([CHANGE_TYPE.DATA, puzzle.data])
  }

  const _pieceChange = (pieceIdx: number): void => {
    changes.push([
      CHANGE_TYPE.PIECE,
      Util.encodePiece(getPiece(gameId, pieceIdx)),
    ])
  }

  const _pieceChanges = (pieceIdxs: Array<number>): void => {
    for (const pieceIdx of pieceIdxs) {
      _pieceChange(pieceIdx)
    }
  }

  const _playerChange = (): void => {
    const player = getPlayer(gameId, clientId)
    if (!player) {
      return
    }
    changes.push([CHANGE_TYPE.PLAYER, Util.encodePlayer(player)])
  }

  let anySnapped: boolean = false
  let anyDropped: boolean = false

  // put both pieces (and their grouped pieces) in the same group
  const groupPieces = (
    gameId: GameId,
    pieceIdx1: number,
    pieceIdx2: number,
  ): void => {
    const pieces = GAMES[gameId].puzzle.tiles
    const group1 = getPieceGroup(gameId, pieceIdx1)
    const group2 = getPieceGroup(gameId, pieceIdx2)

    let group
    const searchGroups: number[] = []
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

    changePiece(gameId, pieceIdx1, { group })
    _pieceChange(pieceIdx1)
    changePiece(gameId, pieceIdx2, { group })
    _pieceChange(pieceIdx2)

    // TODO: strange
    if (searchGroups.length > 0) {
      for (const p of pieces) {
        const piece = Util.decodePiece(p)
        if (searchGroups.includes(piece.group)) {
          changePiece(gameId, piece.idx, { group })
          _pieceChange(piece.idx)
        }
      }
    }
  }

  const type = gameEvent[0]
  if (type === GAME_EVENT_TYPE.INPUT_EV_CONNECTION_CLOSE) {
    // player lost connection, so un-own all their pieces
    const pieceIdx = getFirstOwnedPieceIdx(gameId, clientId)
    if (pieceIdx >= 0) {
      const pieceIdxs = getGroupedPieceIdxs(gameId, pieceIdx)
      setPiecesOwner(gameId, pieceIdxs, 0)
      _pieceChanges(pieceIdxs)
      anyDropped = true
    }
  } else if (type === GAME_EVENT_TYPE.INPUT_EV_BG_COLOR) {
    const bgcolor = gameEvent[1]
    changePlayer(gameId, clientId, { bgcolor, ts })
    _playerChange()
  } else if (type === GAME_EVENT_TYPE.INPUT_EV_PLAYER_COLOR) {
    const color = gameEvent[1]
    changePlayer(gameId, clientId, { color, ts })
    _playerChange()
  } else if (type === GAME_EVENT_TYPE.INPUT_EV_PLAYER_NAME) {
    const name = `${gameEvent[1]}`.substr(0, 16)
    changePlayer(gameId, clientId, { name, ts })
    _playerChange()
  } else if (type === GAME_EVENT_TYPE.INPUT_EV_MOVE) {
    const diffX = gameEvent[1]
    const diffY = gameEvent[2]
    const player = getPlayer(gameId, clientId)
    if (player) {
      const x = player.x - diffX
      const y = player.y - diffY
      changePlayer(gameId, clientId, { ts, x, y })
      _playerChange()
      const pieceIdx = getFirstOwnedPieceIdx(gameId, clientId)
      if (pieceIdx >= 0) {
        // check if pos is on the piece, otherwise dont move
        // (mouse could be out of table, but piece stays on it)
        const pieceIdxs = getGroupedPieceIdxs(gameId, pieceIdx)
        const diff = { x: -diffX, y: -diffY }
        if (movePiecesDiff(gameId, pieceIdxs, diff)) {
          _pieceChanges(pieceIdxs)
        }
      }
    }
  } else if (type === GAME_EVENT_TYPE.INPUT_EV_MOUSE_DOWN) {
    const x = gameEvent[1]
    const y = gameEvent[2]
    const pos = { x, y }

    changePlayer(gameId, clientId, { d: 1, ts })
    _playerChange()

    const tileIdxAtPos = freePieceIdxByPos(gameId, pos)
    if (tileIdxAtPos >= 0) {
      const maxZ = getMaxZIndex(gameId) + 1
      changeData(gameId, { maxZ })
      _dataChange()
      const tileIdxs = getGroupedPieceIdxs(gameId, tileIdxAtPos)
      setPiecesZIndex(gameId, tileIdxs, getMaxZIndex(gameId))
      setPiecesOwner(gameId, tileIdxs, clientId)
      _pieceChanges(tileIdxs)
    }
  } else if (type === GAME_EVENT_TYPE.INPUT_EV_MOUSE_MOVE) {
    const x = gameEvent[1]
    const y = gameEvent[2]
    const down = gameEvent[5]

    if (!down) {
      // player is just moving the hand
      changePlayer(gameId, clientId, { x, y, ts })
      _playerChange()
    } else {
      const pieceIdx = getFirstOwnedPieceIdx(gameId, clientId)
      if (pieceIdx < 0) {
        // player is just moving map, so no change in position!
        changePlayer(gameId, clientId, { ts })
        _playerChange()
      } else {
        const x = gameEvent[1]
        const y = gameEvent[2]
        const diffX = gameEvent[3]
        const diffY = gameEvent[4]

        // player is moving a piece (and hand)
        changePlayer(gameId, clientId, { x, y, ts })
        _playerChange()

        // check if pos is on the piece, otherwise dont move
        // (mouse could be out of table, but piece stays on it)
        const pieceIdxs = getGroupedPieceIdxs(gameId, pieceIdx)
        const diff = { x: diffX, y: diffY }
        if (movePiecesDiff(gameId, pieceIdxs, diff)) {
          _pieceChanges(pieceIdxs)
        }
      }
    }
  } else if (type === GAME_EVENT_TYPE.INPUT_EV_MOUSE_UP) {
    const d = 0 // mouse down = false

    const pieceIdx = getFirstOwnedPieceIdx(gameId, clientId)
    if (pieceIdx >= 0) {
      // drop the piece(s)
      const pieceIdxs = getGroupedPieceIdxs(gameId, pieceIdx)
      setPiecesOwner(gameId, pieceIdxs, 0)
      _pieceChanges(pieceIdxs)
      anyDropped = true

      // Check if the piece was dropped near the final location
      const piecePos = getPiecePos(gameId, pieceIdx)
      const finalPiecePos = getFinalPiecePos(gameId, pieceIdx)

      if (
        maySnapToFinal(gameId, pieceIdxs)
        && Geometry.pointDistance(finalPiecePos, piecePos) < puzzle.info.snapDistance
      ) {
        const diff = Geometry.pointSub(finalPiecePos, piecePos)
        // Snap the piece to the final destination
        movePiecesDiff(gameId, pieceIdxs, diff)
        finishPieces(gameId, pieceIdxs)
        _pieceChanges(pieceIdxs)

        let points = getPlayerPoints(gameId, clientId)
        if (getScoreMode(gameId) === ScoreMode.FINAL) {
          points += pieceIdxs.length
        } else if (getScoreMode(gameId) === ScoreMode.ANY) {
          points += 1
        } else {
          // no score mode... should never occur, because there is a
          // fallback to ScoreMode.FINAL in getScoreMode function
        }
        changePlayer(gameId, clientId, { d, ts, points })
        _playerChange()

        // check if the puzzle is finished
        if (getFinishedPiecesCount(gameId) === getPieceCount(gameId)) {
          changeData(gameId, { finished: ts })
          _dataChange()
        }

        anySnapped = true
      } else {
        // Snap to other pieces
        const check = (
          gameId: GameId,
          pieceIdx: number,
          otherPieceIdx: number,
          off: Array<number>,
        ): boolean => {
          const info = GAMES[gameId].puzzle.info
          if (otherPieceIdx < 0) {
            return false
          }
          if (areGrouped(gameId, pieceIdx, otherPieceIdx)) {
            return false
          }
          const piecePos = getPiecePos(gameId, pieceIdx)
          const dstPos = Geometry.pointAdd(
            getPiecePos(gameId, otherPieceIdx),
            { x: off[0] * info.tileSize, y: off[1] * info.tileSize },
          )
          if (Geometry.pointDistance(piecePos, dstPos) < info.snapDistance) {
            const diff = Geometry.pointSub(dstPos, piecePos)
            let pieceIdxs = getGroupedPieceIdxs(gameId, pieceIdx)
            movePiecesDiff(gameId, pieceIdxs, diff)
            groupPieces(gameId, pieceIdx, otherPieceIdx)
            pieceIdxs = getGroupedPieceIdxs(gameId, pieceIdx)
            if (isFinishedPiece(gameId, otherPieceIdx)) {
              finishPieces(gameId, pieceIdxs)
            } else {
              const zIndex = getMaxZIndexByPieceIdxs(gameId, pieceIdxs)
              setPiecesZIndex(gameId, pieceIdxs, zIndex)
            }
            _pieceChanges(pieceIdxs)
            return true
          }
          return false
        }

        let snapped = false
        for (const pieceIdxTmp of getGroupedPieceIdxs(gameId, pieceIdx)) {
          const othersIdxs = getSurroundingPiecesByIdx(gameId, pieceIdxTmp)
          if (
            check(gameId, pieceIdxTmp, othersIdxs[0], [0, 1]) // top
            || check(gameId, pieceIdxTmp, othersIdxs[1], [-1, 0]) // right
            || check(gameId, pieceIdxTmp, othersIdxs[2], [0, -1]) // bottom
            || check(gameId, pieceIdxTmp, othersIdxs[3], [1, 0]) // left
          ) {
            snapped = true
            break
          }
        }
        const playerChange: PlayerChange = { d, ts }
        if (snapped && getScoreMode(gameId) === ScoreMode.ANY) {
          playerChange.points = getPlayerPoints(gameId, clientId) + 1
        } else if (
          snapped
          && getScoreMode(gameId) === ScoreMode.FINAL
          && isFinishedPiece(gameId, pieceIdx)
        ) {
          playerChange.points = getPlayerPoints(gameId, clientId) + pieceIdxs.length
        }
        changePlayer(gameId, clientId, playerChange)
        _playerChange()

        if (snapped && getSnapMode(gameId) === SnapMode.REAL) {
          if (getFinishedPiecesCount(gameId) === getPieceCount(gameId)) {
            changeData(gameId, { finished: ts })
            _dataChange()
          }
        }
        if (snapped) {
          anySnapped = true
        }
      }
    } else {
      changePlayer(gameId, clientId, { d, ts })
      _playerChange()
    }
  } else if (type === GAME_EVENT_TYPE.INPUT_EV_ZOOM_IN) {
    const x = gameEvent[1]
    const y = gameEvent[2]
    changePlayer(gameId, clientId, { x, y, ts })
    _playerChange()
  } else if (type === GAME_EVENT_TYPE.INPUT_EV_ZOOM_OUT) {
    const x = gameEvent[1]
    const y = gameEvent[2]
    changePlayer(gameId, clientId, { x, y, ts })
    _playerChange()
  } else {
    changePlayer(gameId, clientId, { ts })
    _playerChange()
  }

  if (anySnapped) {
    changes.push([CHANGE_TYPE.PLAYER_SNAP, clientId])
  }
  return { changes, anySnapped, anyDropped }
}

function handleLogEntry(
  gameId: GameId,
  logEntry: LogEntry,
  ts: Timestamp,
): boolean {
  const entry = logEntry
  if (entry[0] === LOG_TYPE.ADD_PLAYER) {
    const clientId = entry[1] as ClientId
    addPlayer(gameId, clientId, ts)
    return true
  }
  if (entry[0] === LOG_TYPE.UPDATE_PLAYER) {
    const clientId = getPlayerIdByIndex(gameId, entry[1])
    if (!clientId) {
      throw '[ 2021-05-17 player not found (update player) ]'
    }
    addPlayer(gameId, clientId, ts)
    return true
  }
  if (entry[0] === LOG_TYPE.GAME_EVENT) {
    const playerId = getPlayerIdByIndex(gameId, entry[1])
    if (!playerId) {
      throw '[ 2021-05-17 player not found (handle input) ]'
    }
    const input = entry[2]
    handleGameEvent(gameId, playerId, input, ts)
    return true
  }
  return false
}

// functions that operate on given game instance instead of global one
// -------------------------------------------------------------------

function Game_isPrivate(game: Game): boolean {
  return game.private
}

function Game_getStartTs(game: Game): number {
  return game.puzzle.data.started
}

function Game_getFinishTs(game: Game): number {
  return game.puzzle.data.finished
}

function Game_getTableDim(game: Game): Dim {
  return {
    w: game.puzzle.info.table.width,
    h: game.puzzle.info.table.height,
  }
}
function Game_getBoardDim(game: Game): Dim {
  return {
    w: game.puzzle.info.width,
    h: game.puzzle.info.height,
  }
}

function Game_getPieceDrawOffset(game: Game) {
  return game.puzzle.info.tileDrawOffset
}

function Game_getPieceDrawSize(game: Game) {
  return game.puzzle.info.tileDrawSize
}

function Game_getBoardPos(game: Game) {
  const tableDim = Game_getTableDim(game)
  const boardDim = Game_getBoardDim(game)
  return {
    x: (tableDim.w - boardDim.w) / 2,
    y: (tableDim.h - boardDim.h) / 2,
  }
}

function Game_getPieceDim(game: Game) {
  const pieceDrawSize = Game_getPieceDrawSize(game)
  return {
    w: pieceDrawSize,
    h: pieceDrawSize,
  }
}

function Game_getVersion(game: Game): number {
  return game.gameVersion
}

function Game_getBounds(game: Game) {
  const gameVersion = Game_getVersion(game)
  if (gameVersion <= 3) {
    return Game_getBounds_v3(game)
  }
  return Game_getBounds_v4(game)
}

const Game_getTableWidth = (game: Game): number => {
  return game.puzzle.info.table.width
}

const Game_getTableHeight = (game: Game): number => {
  return game.puzzle.info.table.height
}

function Game_getPiecesSortedByZIndex(game: Game): Piece[] {
  const pieces = game.puzzle.tiles.map(Util.decodePiece)
  return pieces.sort((t1, t2) => t1.z - t2.z)
}

function Game_getPuzzle(game: Game): Puzzle {
  return game.puzzle
}

function Game_getFinishedPiecesCount(game: Game): number {
  let count = 0
  for (const t of game.puzzle.tiles) {
    if (Util.decodePiece(t).owner === -1) {
      count++
    }
  }
  return count
}

function Game_getPieceCount(game: Game): number {
  return game.puzzle.tiles.length
}

function Game_getScoreMode(game: Game): ScoreMode {
  return game.scoreMode
}

function Game_getSnapMode(game: Game): SnapMode {
  return game.snapMode
}

function Game_getShapeMode(game: Game): ShapeMode {
  return game.shapeMode
}

function Game_getAllPlayers(game: Game): Array<Player> {
  return game.players.map(Util.decodePlayer)
}

function Game_getPlayersWithScore(game: Game): Array<Player> {
  return Game_getAllPlayers(game).filter((p: Player) => p.points > 0)
}

function Game_getActivePlayers(game: Game, ts: number): Array<Player> {
  const minTs = ts - IDLE_TIMEOUT_SEC * Time.SEC
  return Game_getAllPlayers(game).filter((p: Player) => p.ts >= minTs)
}

function Game_getIdlePlayers(game: Game, ts: number): Player[] {
  const minTs = ts - IDLE_TIMEOUT_SEC * Time.SEC
  return Game_getAllPlayers(game).filter((p: Player) => p.ts < minTs && p.points > 0)
}

function Game_getRegisteredMap(game: Game): RegisteredMap {
  return game.registeredMap
}

function Game_getImage(game: Game): ImageInfo {
  return game.puzzle.info.image
}

function Game_getImageUrl(game: Game): string {
  const imageUrl = Game_getImage(game).url
  if (!imageUrl) {
    throw new Error('[2021-07-11] no image url set')
  }
  if (game.crop) {
    return cropUrl(imageUrl, game.crop)
  }
  return imageUrl
}

function Game_isFinished(game: Game): boolean {
  return Game_getFinishedPiecesCount(game) === Game_getPieceCount(game)
}

export default {
  onGameLoadingStateChange,
  setGameLoading,
  isGameLoading,
  setGame,
  setRegisteredMap,
  unsetGame,
  loaded,
  playerExists,
  getActivePlayers,
  getIdlePlayers,
  getRegisteredMap,
  addPlayer,
  getFinishedPiecesCount,
  getPieceCount,
  getImageUrl,
  get,
  getGroupedPieceCount,
  getPlayerBgColor,
  getPlayerColor,
  getPlayerName,
  getPlayerIndexById,
  getPlayerIdByIndex,
  changePlayer,
  setPlayer,
  setPiece,
  setPuzzleData,
  getBounds,
  getTableWidth,
  getTableHeight,
  getTableDim,
  getBoardDim,
  getBoardPos,
  getPieceDim,
  getPuzzle,
  getRng,
  getPuzzleWidth,
  getPuzzleHeight,
  getPiecesSortedByZIndex,
  getFirstOwnedPiece,
  getPieceDrawOffset,
  getPieceDrawSize,
  getFinalPiecePos,
  getPiecesBounds,
  getStartTs,
  getFinishTs,
  getScoreMode,
  getSnapMode,
  getShapeMode,
  handleGameEvent,
  handleLogEntry,

  /// operate directly on the game object given
  Game_getTableDim,
  Game_getBoardDim,
  Game_getPieceDrawOffset,
  Game_getBoardPos,
  Game_getPieceDim,
  Game_getBounds,
  Game_getPiecesSortedByZIndex,
  Game_getPuzzle,
  Game_isPrivate,
  Game_getStartTs,
  Game_getFinishTs,
  Game_getFinishedPiecesCount,
  Game_getPieceCount,
  Game_getActivePlayers,
  Game_getPlayersWithScore,
  Game_getImage,
  Game_getImageUrl,
  Game_getScoreMode,
  Game_getSnapMode,
  Game_getShapeMode,
  Game_isFinished,
}
