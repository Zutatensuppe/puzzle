import { PuzzleCreationInfo } from './Puzzle'
import {
  BasicPlayerInfo,
  DefaultRotationMode,
  EncodedGame,
  EncodedGameLegacy,
  EncodedPieceShape,
  EncodedPlayer,
  EncodedPlayerIdx,
  Game,
  PieceRotation,
  PieceShape,
  PuzzleInfo,
  RotationMode,
  ScoreMode,
  ShapeMode,
  SnapMode,
} from './Types'
import { Point } from './Geometry'
import { Rng } from './Rng'

const slug = (str: string): string => {
  let tmp = str.toLowerCase()
  tmp = tmp.replace(/[^a-z0-9]+/g, '-')
  tmp = tmp.replace(/^-|-$/, '')
  return tmp
}

const pad = (x: number, pad: string): string => {
  const str = `${x}`
  if (str.length >= pad.length) {
    return str
  }
  return pad.substring(0, pad.length - str.length) + str
}

type LogArgs = any[]
type LogFn = (...args: LogArgs) => void

const NOOP = () => { return }

export const logger = (...pre: string[]): { log: LogFn, error: LogFn, info: LogFn, disable: () => void } => {

  const log = (m: 'log' | 'info' | 'error') => (...args: LogArgs): void => {
    const d = new Date()
    const date = dateformat('hh:mm:ss', d)
    console[m](`${date}`, ...pre, ...args)
  }
  return {
    log: log('log'),
    error: log('error'),
    info: log('info'),
    disable: function () {
      this.info = NOOP
      this.error = NOOP
      this.info = NOOP
    },
  }
}

// get a unique id
export const uniqId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2)
}

function encodeShape(data: PieceShape): EncodedPieceShape {
  /* encoded in 1 byte:
    00000000
          ^^ top
        ^^   right
      ^^     bottom
    ^^       left
  */
  return ((data.top + 1) << 0)
    | ((data.right + 1) << 2)
    | ((data.bottom + 1) << 4)
    | ((data.left + 1) << 6)
}

function decodeShape(data: EncodedPieceShape): PieceShape {
  return {
    top: (data >> 0 & 0b11) - 1,
    right: (data >> 2 & 0b11) - 1,
    bottom: (data >> 4 & 0b11) - 1,
    left: (data >> 6 & 0b11) - 1,
  }
}

function rotateShape(shape: PieceShape, rotation: PieceRotation): PieceShape {
  switch (rotation) {
    case PieceRotation.R90:
      return {
        top: shape.left,
        right: shape.top,
        bottom: shape.right,
        left: shape.bottom,
      }
    case PieceRotation.R180:
      return {
        top: shape.bottom,
        right: shape.left,
        bottom: shape.top,
        left: shape.right,
      }
    case PieceRotation.R270:
      return {
        top: shape.right,
        right: shape.bottom,
        bottom: shape.left,
        left: shape.top,
      }
    case PieceRotation.R0:
    default:
      return shape
  }
}

function rotateEncodedShape(
  shape: EncodedPieceShape,
  rotation: PieceRotation | undefined,
): EncodedPieceShape {
  switch (rotation) {
    case PieceRotation.R90:
      return (shape >> 6 | shape << 2) & 0b11111111
    case PieceRotation.R180:
      return (shape >> 4 | shape << 4) & 0b11111111
      case PieceRotation.R270:
      return (shape >> 2 | shape << 6) & 0b11111111
    case PieceRotation.R0:
    default:
      return shape
  }
}

function encodeGame(data: Game): EncodedGame | EncodedGameLegacy {
  return data.crop ? [
    data.id,
    data.rng.type || '',
    Rng.serialize(data.rng.obj),
    data.puzzle,
    data.players,
    data.scoreMode,
    data.shapeMode,
    data.snapMode,
    data.creatorUserId,
    data.hasReplay,
    data.gameVersion,
    data.private,
    data.crop,
    data.registeredMap,
    data.rotationMode,
    data.joinPassword,
    data.requireAccount,
    data.banned,
  ] : [
    data.id,
    data.rng.type || '',
    Rng.serialize(data.rng.obj),
    data.puzzle,
    data.players,
    data.scoreMode,
    data.shapeMode,
    data.snapMode,
    data.creatorUserId,
    data.hasReplay,
    data.gameVersion,
    data.private,
  ]
}

export const playerToBasicPlayerInfo = (p: EncodedPlayer): BasicPlayerInfo => {
  return {
    id: p[EncodedPlayerIdx.ID],
    color: p[EncodedPlayerIdx.COLOR],
    name: p[EncodedPlayerIdx.NAME],
    points: p[EncodedPlayerIdx.POINTS],
  }
}

const isEncodedGameLegacy = (data: EncodedGame | EncodedGameLegacy): data is EncodedGameLegacy => {
  return data.length <= 12
}

function decodeGame(data: EncodedGame | EncodedGameLegacy): Game {
  if (isEncodedGameLegacy(data)) {
    return {
      id: data[0],
      rng: {
        type: data[1],
        obj: Rng.unserialize(data[2]),
      },
      puzzle: data[3],
      players: data[4],
      scoreMode: data[5],
      shapeMode: data[6],
      snapMode: data[7],
      rotationMode: RotationMode.NONE,
      creatorUserId: data[8],
      hasReplay: data[9],
      gameVersion: data[10],
      private: data[11],
      registeredMap: {},
      joinPassword: null,
      requireAccount: false,
      banned: {},
    }
  }

  return {
    id: data[0],
    rng: {
      type: data[1],
      obj: Rng.unserialize(data[2]),
    },
    puzzle: data[3],
    players: data[4],
    scoreMode: data[5],
    shapeMode: data[6],
    snapMode: data[7],
    rotationMode: DefaultRotationMode(data[14]),
    creatorUserId: data[8],
    hasReplay: data[9],
    gameVersion: data[10],
    private: data[11],
    crop: data[12],
    registeredMap: data[13],
    joinPassword: data[15] || null,
    requireAccount: data[16] || false,
    banned: data[17] || {},
  }
}

/**
 * @deprecated Uses PuzzleInfo with 'tileSize' prop :(
 */
function coordByPieceIdxDeprecated(info: PuzzleInfo, pieceIdx: number): Point {
  const wPieces = info.width / info.tileSize
  return {
    x: pieceIdx % wPieces,
    y: Math.floor(pieceIdx / wPieces),
  }
}

function coordByPieceIdx(info: PuzzleCreationInfo, pieceIdx: number): Point {
  const wPieces = info.width / info.pieceSize
  return {
    x: pieceIdx % wPieces,
    y: Math.floor(pieceIdx / wPieces),
  }
}

const hash = (str: string): number => {
  let hash = 0

  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + chr
    hash |= 0 // Convert to 32bit integer
  }
  return hash
}

function asQueryArgs(data: Record<string, any>): string {
  const q: string[] = []
  for (const k in data) {
    const pair = [k, data[k]].map(encodeURIComponent)
    q.push(pair.join('='))
  }
  if (q.length === 0) {
    return ''
  }
  return `?${q.join('&')}`
}

export const dateformat = (
  format: string,
  date: Date,
): string => {
  return format.replace(/(YYYY|MM|DD|hh|mm|ss|Month(?:\.(?:de|en))?)/g, (m0: string, m1: string) => {
    switch (m1) {
      case 'YYYY': return pad(date.getFullYear(), '0000')
      case 'MM': return pad(date.getMonth() + 1, '00')
      case 'DD': return pad(date.getDate(), '00')
      case 'hh': return pad(date.getHours(), '00')
      case 'mm': return pad(date.getMinutes(), '00')
      case 'ss': return pad(date.getSeconds(), '00')
      default: return m0
    }
  })
}

export const clamp = (val: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, val))
}

export const snapModeToString = (m: SnapMode) => {
  switch (m) {
    case SnapMode.REAL: return 'Real'
    case SnapMode.NORMAL:
    default: return 'Normal'
  }
}
export const snapModeDescriptionToString = (m: SnapMode) => {
  switch (m) {
    case SnapMode.REAL: return 'Pieces snap only to corners, already snapped pieces and to each other'
    case SnapMode.NORMAL:
    default: return 'Pieces snap to final destination and to each other'
  }
}

export const scoreModeToString = (m: ScoreMode) => {
  switch (m) {
    case ScoreMode.ANY: return 'Any'
    case ScoreMode.FINAL:
    default: return 'Final'
  }
}

export const scoreModeDescriptionToString = (m: ScoreMode) => {
  switch (m) {
    case ScoreMode.ANY: return 'Score when pieces are connected to each other or on final location'
    case ScoreMode.FINAL:
    default: return 'Score when pieces are put to their final location'
  }
}

export const shapeModeToString = (m: ShapeMode) => {
  switch (m) {
    case ShapeMode.FLAT: return 'Flat'
    case ShapeMode.ANY: return 'Any'
    case ShapeMode.NORMAL:
    default: return 'Normal'
  }
}

export const shapeModeDescriptionToString = (m: ShapeMode) => {
  switch (m) {
    case ShapeMode.FLAT: return 'All pieces flat on all sides'
    case ShapeMode.ANY: return 'Flat pieces can occur anywhere'
    case ShapeMode.NORMAL:
    default: return 'Normal pieces, flat only on the outside'
  }
}

export const rotationModeToString = (m: RotationMode) => {
  switch (m) {
    case RotationMode.ORTHOGONAL: return 'Simple'
    case RotationMode.NONE:
    default: return 'None'
  }
}

export const rotationModeDescriptionToString = (m: RotationMode) => {
  switch (m) {
    case RotationMode.ORTHOGONAL: return 'Individual pieces can be rotated by 90 degrees at a time'
    case RotationMode.NONE:
    default: return 'Pieces cannot be rotated'
  }
}

export default {
  hash,
  slug,
  pad,
  dateformat,
  uniqId,

  encodeShape,
  decodeShape,

  encodeGame,
  decodeGame,

  coordByPieceIdxDeprecated,
  coordByPieceIdx,

  asQueryArgs,

  rotateShape,
  rotateEncodedShape,
}
