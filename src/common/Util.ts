import { PuzzleCreationInfo } from './Puzzle'
import {
  EncodedGame,
  EncodedGameLegacy,
  EncodedPiece,
  EncodedPieceShape,
  EncodedPlayer,
  Game,
  Piece,
  PieceShape,
  Player,
  PuzzleInfo,
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

type LogArgs = Array<any>
type LogFn = (...args: LogArgs) => void

const NOOP = () => { return }

export const logger = (...pre: string[]): { log: LogFn, error: LogFn, info: LogFn, disable: () => void } => {

  const log = (m: 'log'|'info'|'error') => (...args: LogArgs): void => {
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
  return ((data.top    + 1) << 0)
       | ((data.right  + 1) << 2)
       | ((data.bottom + 1) << 4)
       | ((data.left   + 1) << 6)
}

function decodeShape(data: EncodedPieceShape): PieceShape {
  return {
    top:    (data >> 0 & 0b11) - 1,
    right:  (data >> 2 & 0b11) - 1,
    bottom: (data >> 4 & 0b11) - 1,
    left:   (data >> 6 & 0b11) - 1,
  }
}

function encodePiece(data: Piece): EncodedPiece {
  return [data.idx, data.pos.x, data.pos.y, data.z, data.owner, data.group]
}

function decodePiece(data: EncodedPiece): Piece {
  return {
    idx: data[0],
    pos: {
      x: data[1],
      y: data[2],
    },
    z: data[3],
    owner: data[4],
    group: data[5],
  }
}

function encodePlayer(data: Player): EncodedPlayer {
  return [
    data.id,
    data.x,
    data.y,
    data.d,
    data.name,
    data.color,
    data.bgcolor,
    data.points,
    data.ts,
  ]
}

function decodePlayer(data: EncodedPlayer): Player {
  return {
    id: data[0],
    x: data[1],
    y: data[2],
    d: data[3], // mouse down
    name: data[4],
    color: data[5],
    bgcolor: data[6],
    points: data[7],
    ts: data[8],
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
      creatorUserId: data[8],
      hasReplay: data[9],
      gameVersion: data[10],
      private: data[11],
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
    creatorUserId: data[8],
    hasReplay: data[9],
    gameVersion: data[10],
    private: data[11],
    crop: data[12],
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
  const q = []
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

export default {
  hash,
  slug,
  pad,
  dateformat,
  uniqId,

  encodeShape,
  decodeShape,

  encodePiece,
  decodePiece,

  encodePlayer,
  decodePlayer,

  encodeGame,
  decodeGame,

  coordByPieceIdxDeprecated,
  coordByPieceIdx,

  asQueryArgs,
}
