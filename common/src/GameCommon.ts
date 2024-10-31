import Geometry, { Dim, Point, Rect } from './Geometry'
import { cropUrl } from './ImageService'
import { CHANGE_TYPE, GAME_EVENT_TYPE, LOG_TYPE } from './Protocol'
import { Rng } from './Rng'
import Time from './Time'
import {
  Change,
  ClientId,
  EncodedPiece,
  EncodedPieceIdx,
  EncodedPlayer,
  EncodedPlayerIdx,
  Game,
  GameEvent,
  GameId,
  HandleGameEventResult,
  ImageInfo,
  LogEntry,
  PieceChange,
  PieceRotation,
  PlayerChange,
  Puzzle,
  PuzzleData,
  PuzzleDataChange,
  RegisteredMap,
  RotationMode,
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

function __createPlayerObject(id: ClientId, ts: Timestamp): EncodedPlayer {
  const player = [] as unknown as EncodedPlayer
  player[EncodedPlayerIdx.ID] = id
  player[EncodedPlayerIdx.X] = 0
  player[EncodedPlayerIdx.Y] = 0
  player[EncodedPlayerIdx.MOUSEDOWN] = 0
  player[EncodedPlayerIdx.NAME] = null
  player[EncodedPlayerIdx.COLOR] = null
  player[EncodedPlayerIdx.BGCOLOR] = null
  player[EncodedPlayerIdx.POINTS] = 0
  player[EncodedPlayerIdx.TIMESTAMP] = ts
  return player
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
    if (player[EncodedPlayerIdx.ID] === clientId) {
      return i
    }
    i++
  }
  return -1
}

function getPlayerIdByIndex(gameId: GameId, playerIndex: number): ClientId | null {
  if (GAMES[gameId].players.length > playerIndex) {
    return GAMES[gameId].players[playerIndex][EncodedPlayerIdx.ID]
  }
  return null
}

function getPlayer(gameId: GameId, clientId: ClientId): EncodedPlayer | null {
  const idx = getPlayerIndexById(gameId, clientId)
  if (idx === -1) {
    return null
  }
  return GAMES[gameId].players[idx]
}

function setPlayer(
  gameId: GameId,
  clientId: ClientId,
  player: EncodedPlayer,
): void {
  const idx = getPlayerIndexById(gameId, clientId)
  if (idx === -1) {
    GAMES[gameId].players.push(player)
  } else {
    GAMES[gameId].players[idx] = player
  }
}

function setPiece(gameId: GameId, pieceIdx: number, piece: EncodedPiece): void {
  GAMES[gameId].puzzle.tiles[pieceIdx] = piece
}

function setPuzzleData(gameId: GameId, data: PuzzleData): void {
  GAMES[gameId].puzzle.data = data
}

function playerExists(gameId: GameId, clientId: ClientId): boolean {
  const idx = getPlayerIndexById(gameId, clientId)
  return idx !== -1
}

function getActivePlayers(gameId: GameId, ts: number): EncodedPlayer[] {
  return Game_getActivePlayers(GAMES[gameId], ts)
}

function getIdlePlayers(gameId: GameId, ts: number): EncodedPlayer[] {
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
    changePlayer(gameId, clientId, { [EncodedPlayerIdx.TIMESTAMP]: ts })
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

function getRotationMode(gameId: GameId): RotationMode {
  return Game_getRotationMode(GAMES[gameId])
}

function getVersion(gameId: GameId): number {
  return Game_getVersion(GAMES[gameId])
}

function getFinishedPiecesCount(gameId: GameId): number {
  return Game_getFinishedPiecesCount(GAMES[gameId])
}

function getEncodedPieces(gameId: GameId): EncodedPiece[] {
  return Game_getEncodedPieces(GAMES[gameId])
}

function getEncodedPiecesSortedByZIndex(gameId: GameId): EncodedPiece[] {
  return Game_getEncodedPiecesSortedByZIndex(GAMES[gameId])
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
    const piece = GAMES[gameId].puzzle.tiles[pieceIdx]
    // @ts-ignore
    piece[k] = change[k]
    GAMES[gameId].puzzle.tiles[pieceIdx] = piece
  }
}

const getEncodedPiece = (gameId: GameId, pieceIdx: number): EncodedPiece => {
  return GAMES[gameId].puzzle.tiles[pieceIdx]
}

const getPieceGroup = (gameId: GameId, pieceIdx: number): number => {
  const piece = getEncodedPiece(gameId, pieceIdx)
  return piece[EncodedPieceIdx.GROUP]
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

const getFinalPieceOffset = (
  gameId: GameId,
  pieceIdxA: number,
  pieceIdxB: number,
): Point => {
  const info = GAMES[gameId].puzzle.info

  const coordA = Util.coordByPieceIdxDeprecated(info, pieceIdxA)
  const coordB = Util.coordByPieceIdxDeprecated(info, pieceIdxB)

  const offset = Geometry.pointSub(coordB, coordA)
  return {
    x: offset.x * info.tileSize,
    y: offset.y * info.tileSize,
  }
}

const getFinalPiecePos = (gameId: GameId, pieceIdx: number): Point => {
  const info = GAMES[gameId].puzzle.info
  const boardPos = {
    x: (info.table.width - info.width) / 2,
    y: (info.table.height - info.height) / 2,
  }
  const srcPos = getSrcPosByPieceIdx(gameId, pieceIdx)
  return Geometry.pointAdd(boardPos, srcPos)
}

const getPieceRotation = (gameId: GameId, pieceIdx: number): PieceRotation => {
  const piece = getEncodedPiece(gameId, pieceIdx)
  return piece[EncodedPieceIdx.ROTATION] || PieceRotation.R0
}

const getPiecePos = (gameId: GameId, pieceIdx: number): Point => {
  const piece = getEncodedPiece(gameId, pieceIdx)
  return {
    x: piece[EncodedPieceIdx.POS_X],
    y: piece[EncodedPieceIdx.POS_Y],
  }
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

  let piece: EncodedPiece = GAMES[gameId].puzzle.tiles[0]

  let minX = piece[EncodedPieceIdx.POS_X]
  let minY = piece[EncodedPieceIdx.POS_Y]
  let maxX = piece[EncodedPieceIdx.POS_X]
  let maxY = piece[EncodedPieceIdx.POS_Y]
  for (let i = 1; i < GAMES[gameId].puzzle.tiles.length; i++) {
    piece = GAMES[gameId].puzzle.tiles[i]
    if (piece[EncodedPieceIdx.POS_X] < minX) minX = piece[EncodedPieceIdx.POS_X]
    if (piece[EncodedPieceIdx.POS_X] > maxX) maxX = piece[EncodedPieceIdx.POS_X]
    if (piece[EncodedPieceIdx.POS_Y] < minY) minY = piece[EncodedPieceIdx.POS_Y]
    if (piece[EncodedPieceIdx.POS_Y] > maxY) maxY = piece[EncodedPieceIdx.POS_Y]
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
  return getEncodedPiece(gameId, pieceIdx)[EncodedPieceIdx.Z]
}

const getFirstOwnedPieceIdx = (gameId: GameId, clientId: ClientId): number => {
  const player = getPlayer(gameId, clientId)
  if (player) {
    const idx = pieceIdxByXy(
      gameId,
      player[EncodedPlayerIdx.X],
      player[EncodedPlayerIdx.Y],
      player[EncodedPlayerIdx.ID],
    )
    if (idx !== -1) {
      return idx
    }
  }
  for (const piece of GAMES[gameId].puzzle.tiles) {
    if (piece[EncodedPieceIdx.OWNER] === clientId) {
      return piece[EncodedPieceIdx.IDX]
    }
  }
  return -1
}

const getFirstOwnedPiece = (
  gameId: GameId,
  clientId: ClientId,
): EncodedPiece | null => {
  const idx = getFirstOwnedPieceIdx(gameId, clientId)
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

const getMaxZIndexByPieceIdxs = (gameId: GameId, pieceIdxs: number[]): number => {
  let maxZ = 0
  for (const pieceIdx of pieceIdxs) {
    const curZ = getPieceZIndex(gameId, pieceIdx)
    if (curZ > maxZ) {
      maxZ = curZ
    }
  }
  return maxZ
}

function getSrcPosByPieceIdx(gameId: GameId, pieceIdx: number): Point {
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

const setPiecesZIndex = (gameId: GameId, pieceIdxs: number[], zIndex: number): void => {
  for (const pieceIdx of pieceIdxs) {
    changePiece(gameId, pieceIdx, { [EncodedPieceIdx.Z]: zIndex })
  }
}

const movePieceDiff = (gameId: GameId, pieceIdx: number, diff: Point): void => {
  const oldPos = getPiecePos(gameId, pieceIdx)
  const pos = Geometry.pointAdd(oldPos, diff)
  changePiece(gameId, pieceIdx, { [EncodedPieceIdx.POS_X]: pos.x, [EncodedPieceIdx.POS_Y]: pos.y })
}

const movePiecesDiff = (
  gameId: GameId,
  pieceIdxs: number[],
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
  pieceIdxs: number[],
  diff: Point,
): boolean => {
  const drawSize = getPieceDrawSize(gameId)
  const bounds = getBounds(gameId)
  const cappedDiff = diff

  for (const pieceIdx of pieceIdxs) {
    const piece = getEncodedPiece(gameId, pieceIdx)
    if (piece[EncodedPieceIdx.POS_X] + diff.x < bounds.x) {
      cappedDiff.x = Math.max(bounds.x - piece[EncodedPieceIdx.POS_X], cappedDiff.x)
    } else if (piece[EncodedPieceIdx.POS_X] + drawSize + diff.x > bounds.x + bounds.w) {
      cappedDiff.x = Math.min(bounds.x + bounds.w - piece[EncodedPieceIdx.POS_X] + drawSize, cappedDiff.x)
    }
    if (piece[EncodedPieceIdx.POS_Y] + diff.y < bounds.y) {
      cappedDiff.y = Math.max(bounds.y - piece[EncodedPieceIdx.POS_Y], cappedDiff.y)
    } else if (piece[EncodedPieceIdx.POS_Y] + drawSize + diff.y > bounds.y + bounds.h) {
      cappedDiff.y = Math.min(bounds.y + bounds.h - piece[EncodedPieceIdx.POS_Y] + drawSize, cappedDiff.y)
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
  pieceIdxs: number[],
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
    const piece = getEncodedPiece(gameId, pieceIdx)
    if (diff.x < 0) {
      cappedDiff.x = Math.max(minX - piece[EncodedPieceIdx.POS_X], cappedDiff.x)
    } else {
      cappedDiff.x = Math.min(maxX - piece[EncodedPieceIdx.POS_X], cappedDiff.x)
    }
    if (diff.y < 0) {
      cappedDiff.y = Math.max(minY - piece[EncodedPieceIdx.POS_Y], cappedDiff.y)
    } else {
      cappedDiff.y = Math.min(maxY - piece[EncodedPieceIdx.POS_Y], cappedDiff.y)
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
  return getEncodedPiece(gameId, pieceIdx)[EncodedPieceIdx.OWNER]
}

const finishPieces = (gameId: GameId, pieceIdxs: number[]): void => {
  for (const pieceIdx of pieceIdxs) {
    changePiece(gameId, pieceIdx, { [EncodedPieceIdx.OWNER]: -1, [EncodedPieceIdx.Z]: 1 })
  }
}

const rotatePieces = (
  gameId: GameId,
  heldPieceIdx: number,
  pieceIdxs: number[],
  direction: -1 | 1,
): void => {
  // find the (new) rotation of the held piece
  const heldPiece = getEncodedPiece(gameId, heldPieceIdx)
  let rot = (heldPiece[EncodedPieceIdx.ROTATION] || 0) + direction
  rot = rot < 0 ? 3 : rot % 4

  // each other piece will get the same rotation as the held piece
  // pieceIdxs contains the held piece, so we rotate them all in a for loop
  // no extra changePiece call required for the held piece
  for (const pieceIdx of pieceIdxs) {
    changePiece(gameId, pieceIdx, { [EncodedPieceIdx.ROTATION]: rot })
  }

  // the other pieces also need to change their location
  for (const pieceIdx of pieceIdxs) {
    if (pieceIdx === heldPieceIdx) {
      continue
    }
    const offset = Geometry.pointRotate(getFinalPieceOffset(gameId, heldPieceIdx, pieceIdx), rot)
    const pos = Geometry.pointAdd({
      x: heldPiece[EncodedPieceIdx.POS_X],
      y: heldPiece[EncodedPieceIdx.POS_Y],
    }, offset)
    changePiece(gameId, pieceIdx, { [EncodedPieceIdx.POS_X]: pos.x, [EncodedPieceIdx.POS_Y]: pos.y })
  }
}

const setPiecesOwner = (
  gameId: GameId,
  pieceIdxs: number[],
  owner: ClientId | number,
): void => {
  for (const pieceIdx of pieceIdxs) {
    changePiece(gameId, pieceIdx, { [EncodedPieceIdx.OWNER]: owner })
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
  const piece = pieces[pieceIdx]

  const grouped: number[] = []
  if (piece[EncodedPieceIdx.GROUP]) {
    for (const otherPiece of pieces) {
      if (otherPiece[EncodedPieceIdx.GROUP] === piece[EncodedPieceIdx.GROUP]) {
        grouped.push(otherPiece[EncodedPieceIdx.IDX])
      }
    }
  } else {
    grouped.push(piece[EncodedPieceIdx.IDX])
  }
  return grouped
}

// Returns the index of the puzzle piece with the highest z index
// that is not finished yet and that matches the position
const pieceIdxByXy = (
  gameId: GameId,
  x: number,
  y: number,
  owner: string | number,
): number => {
  const info = GAMES[gameId].puzzle.info
  const pieces = GAMES[gameId].puzzle.tiles

  let maxZ = -1
  let pieceIdx = -1
  for (let idx = 0; idx < pieces.length; idx++) {
    const piece = pieces[idx]
    if (piece[EncodedPieceIdx.OWNER] !== owner) {
      continue
    }

    const collisionRect: Rect = {
      x: piece[EncodedPieceIdx.POS_X],
      y: piece[EncodedPieceIdx.POS_Y],
      w: info.tileSize,
      h: info.tileSize,
    }
    if (Geometry.xyInBounds(x, y, collisionRect)) {
      if (maxZ === -1 || piece[EncodedPieceIdx.Z] > maxZ) {
        maxZ = piece[EncodedPieceIdx.Z]
        pieceIdx = idx
      }
    }
  }
  return pieceIdx
}

const getPlayerBgColor = (gameId: GameId, clientId: ClientId): string | null => {
  const p = getPlayer(gameId, clientId)
  return p ? p[EncodedPlayerIdx.BGCOLOR] : null
}

const getPlayerColor = (gameId: GameId, clientId: ClientId): string | null => {
  const p = getPlayer(gameId, clientId)
  return p ? p[EncodedPlayerIdx.COLOR] : null
}

const getPlayerName = (gameId: GameId, clientId: ClientId): string | null => {
  const p = getPlayer(gameId, clientId)
  return p ? p[EncodedPlayerIdx.NAME] : null
}

const getPlayerPoints = (gameId: GameId, clientId: ClientId): number => {
  const p = getPlayer(gameId, clientId)
  return p ? p[EncodedPlayerIdx.POINTS] : 0
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

  const changes: Change[] = []

  const _dataChange = (): void => {
    changes.push([CHANGE_TYPE.DATA, puzzle.data])
  }

  const _pieceChange = (pieceIdx: number): void => {
    changes.push([
      CHANGE_TYPE.PIECE,
      getEncodedPiece(gameId, pieceIdx),
    ])
  }

  const _pieceChanges = (pieceIdxs: number[]): void => {
    for (const pieceIdx of pieceIdxs) {
      _pieceChange(pieceIdx)
    }
  }

  const _playerChange = (): void => {
    const player = getPlayer(gameId, clientId)
    if (!player) {
      return
    }
    changes.push([CHANGE_TYPE.PLAYER, player])
  }

  let anySnapped: boolean = false
  let anyDropped: boolean = false
  let anyRotated: boolean = false

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

    changePiece(gameId, pieceIdx1, { [EncodedPieceIdx.GROUP]: group })
    _pieceChange(pieceIdx1)
    changePiece(gameId, pieceIdx2, { [EncodedPieceIdx.GROUP]: group })
    _pieceChange(pieceIdx2)

    // TODO: strange
    if (searchGroups.length > 0) {
      for (const piece of pieces) {
        if (searchGroups.includes(piece[EncodedPieceIdx.GROUP])) {
          changePiece(gameId, piece[EncodedPieceIdx.IDX], { [EncodedPieceIdx.GROUP]: group })
          _pieceChange(piece[EncodedPieceIdx.IDX])
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
    changePlayer(gameId, clientId, { [EncodedPlayerIdx.BGCOLOR]: bgcolor, [EncodedPlayerIdx.TIMESTAMP]: ts })
    _playerChange()
  } else if (type === GAME_EVENT_TYPE.INPUT_EV_PLAYER_COLOR) {
    const color = gameEvent[1]
    changePlayer(gameId, clientId, { [EncodedPlayerIdx.COLOR]: color, [EncodedPlayerIdx.TIMESTAMP]: ts })
    _playerChange()
  } else if (type === GAME_EVENT_TYPE.INPUT_EV_PLAYER_NAME) {
    const name = `${gameEvent[1]}`.substr(0, 16)
    changePlayer(gameId, clientId, { [EncodedPlayerIdx.NAME]: name, [EncodedPlayerIdx.TIMESTAMP]: ts })
    _playerChange()
  } else if (type === GAME_EVENT_TYPE.INPUT_EV_MOVE) {
    const diffX = gameEvent[1]
    const diffY = gameEvent[2]
    const player = getPlayer(gameId, clientId)
    if (player) {
      const x = player[EncodedPlayerIdx.X] - diffX
      const y = player[EncodedPlayerIdx.Y] - diffY
      changePlayer(gameId, clientId, { [EncodedPlayerIdx.TIMESTAMP]: ts, [EncodedPlayerIdx.X]: x, [EncodedPlayerIdx.Y]: y })
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

    changePlayer(gameId, clientId, { [EncodedPlayerIdx.MOUSEDOWN]: 1, [EncodedPlayerIdx.TIMESTAMP]: ts })
    _playerChange()

    const tileIdxAtPos = pieceIdxByXy(gameId, x, y, 0)
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
      changePlayer(gameId, clientId, { [EncodedPlayerIdx.X]: x, [EncodedPlayerIdx.Y]: y, [EncodedPlayerIdx.TIMESTAMP]: ts })
      _playerChange()
    } else {
      const pieceIdx = getFirstOwnedPieceIdx(gameId, clientId)
      if (pieceIdx < 0) {
        // player is just moving map, so no change in position!
        changePlayer(gameId, clientId, { [EncodedPlayerIdx.TIMESTAMP]: ts })
        _playerChange()
      } else {
        const x = gameEvent[1]
        const y = gameEvent[2]
        const diffX = gameEvent[3]
        const diffY = gameEvent[4]

        // player is moving a piece (and hand)
        changePlayer(gameId, clientId, { [EncodedPlayerIdx.X]: x, [EncodedPlayerIdx.Y]: y, [EncodedPlayerIdx.TIMESTAMP]: ts })
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
    const mouseDown = 0 // mouse down = false

    const pieceIdx = getFirstOwnedPieceIdx(gameId, clientId)
    if (pieceIdx >= 0) {
      // drop the piece(s)
      const pieceIdxs = getGroupedPieceIdxs(gameId, pieceIdx)
      setPiecesOwner(gameId, pieceIdxs, 0)
      _pieceChanges(pieceIdxs)
      anyDropped = true

      // Check if the piece was dropped near the final location
      const pieceRotation = getPieceRotation(gameId, pieceIdx)
      const piecePos = getPiecePos(gameId, pieceIdx)
      const finalPiecePos = getFinalPiecePos(gameId, pieceIdx)

      if (
        // can only snap to final position if rotated correctly
        pieceRotation === PieceRotation.R0
        && maySnapToFinal(gameId, pieceIdxs)
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
        changePlayer(gameId, clientId, { [EncodedPlayerIdx.MOUSEDOWN]: mouseDown, [EncodedPlayerIdx.TIMESTAMP]: ts, [EncodedPlayerIdx.POINTS]: points })
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
          off: Point,
        ): boolean => {
          const info = GAMES[gameId].puzzle.info
          if (otherPieceIdx < 0) {
            return false
          }
          if (areGrouped(gameId, pieceIdx, otherPieceIdx)) {
            return false
          }
          const otherRotation = getPieceRotation(gameId, otherPieceIdx)
          if (pieceRotation !== otherRotation) {
            return false
          }
          const piecePos = getPiecePos(gameId, pieceIdx)
          const rotatedOff = Geometry.pointRotate(off, pieceRotation)
          const dstPos = Geometry.pointAdd(
            getPiecePos(gameId, otherPieceIdx),
            { x: rotatedOff.x * info.tileSize, y: rotatedOff.y * info.tileSize },
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
            check(gameId, pieceIdxTmp, othersIdxs[0], { x: 0, y: 1 }) // top
            || check(gameId, pieceIdxTmp, othersIdxs[1], { x: -1, y: 0 }) // right
            || check(gameId, pieceIdxTmp, othersIdxs[2], { x: 0, y: -1 }) // bottom
            || check(gameId, pieceIdxTmp, othersIdxs[3], { x: 1, y: 0 }) // left
          ) {
            snapped = true
            break
          }
        }
        const playerChange: PlayerChange = { [EncodedPlayerIdx.MOUSEDOWN]: mouseDown, [EncodedPlayerIdx.TIMESTAMP]: ts }
        if (snapped && getScoreMode(gameId) === ScoreMode.ANY) {
          playerChange[EncodedPlayerIdx.POINTS] = getPlayerPoints(gameId, clientId) + 1
        } else if (
          snapped
          && getScoreMode(gameId) === ScoreMode.FINAL
          && isFinishedPiece(gameId, pieceIdx)
        ) {
          playerChange[EncodedPlayerIdx.POINTS] = getPlayerPoints(gameId, clientId) + pieceIdxs.length
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
      changePlayer(gameId, clientId, { [EncodedPlayerIdx.MOUSEDOWN]: mouseDown, [EncodedPlayerIdx.TIMESTAMP]: ts })
      _playerChange()
    }
  } else if (type === GAME_EVENT_TYPE.INPUT_EV_ROTATE) {
    if (getRotationMode(gameId) === RotationMode.ORTHOGONAL) {
      const pieceIdx = getFirstOwnedPieceIdx(gameId, clientId)
      if (pieceIdx < 0) {
        // player tried to rotate, but holding nothing
        changePlayer(gameId, clientId, { [EncodedPlayerIdx.TIMESTAMP]: ts })
        _playerChange()
      } else {
        // player is rotating a piece (or group of pieces)
        changePlayer(gameId, clientId, { [EncodedPlayerIdx.TIMESTAMP]: ts })
        _playerChange()

        const direction = gameEvent[1] === 0 ? -1 : 1
        const pieceIdxs = getGroupedPieceIdxs(gameId, pieceIdx)
        rotatePieces(gameId, pieceIdx, pieceIdxs, direction)
        _pieceChanges(pieceIdxs)
        anyRotated = true
      }
    } else {
      changePlayer(gameId, clientId, { [EncodedPlayerIdx.TIMESTAMP]: ts })
      _playerChange()
    }
  } else if (type === GAME_EVENT_TYPE.INPUT_EV_ZOOM_IN) {
    const x = gameEvent[1]
    const y = gameEvent[2]
    changePlayer(gameId, clientId, { [EncodedPlayerIdx.X]: x, [EncodedPlayerIdx.Y]: y, [EncodedPlayerIdx.TIMESTAMP]: ts })
    _playerChange()
  } else if (type === GAME_EVENT_TYPE.INPUT_EV_ZOOM_OUT) {
    const x = gameEvent[1]
    const y = gameEvent[2]
    changePlayer(gameId, clientId, { [EncodedPlayerIdx.X]: x, [EncodedPlayerIdx.Y]: y, [EncodedPlayerIdx.TIMESTAMP]: ts })
    _playerChange()
  } else {
    changePlayer(gameId, clientId, { [EncodedPlayerIdx.TIMESTAMP]: ts })
    _playerChange()
  }

  if (anySnapped) {
    changes.push([CHANGE_TYPE.PLAYER_SNAP, clientId])
  }
  return { changes, anySnapped, anyDropped, anyRotated }
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

function Game_getEncodedPieces(game: Game): EncodedPiece[] {
  return game.puzzle.tiles
}

function Game_getEncodedPiecesSortedByZIndex(game: Game): EncodedPiece[] {
  const pieces = game.puzzle.tiles
  return pieces.toSorted((t1, t2) => t1[EncodedPieceIdx.Z] - t2[EncodedPieceIdx.Z])
}

function Game_getPuzzle(game: Game): Puzzle {
  return game.puzzle
}

function Game_getFinishedPiecesCount(game: Game): number {
  let count = 0
  for (const piece of game.puzzle.tiles) {
    if (piece[EncodedPieceIdx.OWNER] === -1) {
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

function Game_getRotationMode(game: Game): RotationMode {
  return game.rotationMode
}

function Game_getAllPlayers(game: Game): EncodedPlayer[] {
  return game.players
}

function Game_getPlayersWithScore(game: Game): EncodedPlayer[] {
  return Game_getAllPlayers(game).filter((p: EncodedPlayer) => p[EncodedPlayerIdx.POINTS] > 0)
}

function Game_getActivePlayers(game: Game, ts: number): EncodedPlayer[] {
  const minTs = ts - IDLE_TIMEOUT_SEC * Time.SEC
  return Game_getAllPlayers(game).filter((p: EncodedPlayer) => p[EncodedPlayerIdx.TIMESTAMP] >= minTs)
}

function Game_getIdlePlayers(game: Game, ts: number): EncodedPlayer[] {
  const minTs = ts - IDLE_TIMEOUT_SEC * Time.SEC
  return Game_getAllPlayers(game).filter((p: EncodedPlayer) => p[EncodedPlayerIdx.TIMESTAMP] < minTs && p[EncodedPlayerIdx.POINTS] > 0)
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
  getMaxZIndex,
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
  getSrcPosByPieceIdx,
  getEncodedPieces,
  getEncodedPiecesSortedByZIndex,
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
  getRotationMode,
  handleGameEvent,
  handleLogEntry,

  /// operate directly on the game object given
  Game_getTableDim,
  Game_getBoardDim,
  Game_getPieceDrawOffset,
  Game_getBoardPos,
  Game_getPieceDim,
  Game_getBounds,
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
  Game_getRotationMode,
  Game_isFinished,
}
