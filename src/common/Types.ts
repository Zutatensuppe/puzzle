import { Point } from "./Geometry"
import { Rng, RngSerialized } from "./Rng"

// @see https://stackoverflow.com/a/59906630/392905
type ArrayLengthMutationKeys = 'splice' | 'push' | 'pop' | 'shift' | 'unshift' | number
type ArrayItems<T extends Array<any>> = T extends Array<infer TItems> ? TItems : never
export type FixedLengthArray<T extends any[]> =
  Pick<T, Exclude<keyof T, ArrayLengthMutationKeys>>
  & { [Symbol.iterator]: () => IterableIterator< ArrayItems<T> > }

export type Timestamp = number

export type Input = any
export type Change = Array<any>

export type GameEvent = Array<any>

export type ServerEvent = Array<any>
export type ClientEvent = Array<any>

export type EncodedPlayer = FixedLengthArray<[
  string,
  number,
  number,
  0|1,
  string|null,
  string|null,
  string|null,
  number,
  Timestamp,
]>

export type EncodedPiece = FixedLengthArray<[
  number,
  number,
  number,
  number,
  string|number,
  number,
]>

export type EncodedPieceShape = number

export type EncodedGame = FixedLengthArray<[
  string,
  string,
  RngSerialized,
  Puzzle,
  Array<EncodedPlayer>,
  ScoreMode,
  ShapeMode,
  SnapMode,
  number|null,
  boolean, // has replay
  number, // gameVersion
  boolean, // private
]>

export interface ReplayData {
  log: any[],
  game: EncodedGame|null
}

export interface Tag {
  id: number
  slug: string
  title: string
  total: number
}

interface GameRng {
  obj: Rng
  type?: string
}

export interface Game {
  id: string
  gameVersion: number
  creatorUserId: number|null
  players: Array<EncodedPlayer>
  puzzle: Puzzle
  scoreMode: ScoreMode
  shapeMode: ShapeMode
  snapMode: SnapMode
  rng: GameRng
  private: boolean
  hasReplay: boolean
}

export interface Image {
  id: number
  filename: string
  file: string
  url: string
  title: string
  tags: Array<Tag>
  created: number
}

export interface GameSettings {
  tiles: number
  private: boolean
  image: ImageInfo
  scoreMode: ScoreMode
  shapeMode: ShapeMode
  snapMode: SnapMode
}

export interface Puzzle {
  tiles: Array<EncodedPiece>
  data: PuzzleData
  info: PuzzleInfo
}

export interface PuzzleData {
  started: number
  finished: number
  maxGroup: number
  maxZ: number
}

export interface PuzzleDataChange {
  started?: number
  finished?: number
  maxGroup?: number
  maxZ?: number
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

export interface PieceChange {
  owner?: string|number
  idx?: number
  pos?: Point
  z?: number
  group?: number
}

export interface ImageInfo
{
  id: number
  uploaderUserId: number|null
  filename: string
  url: string
  title: string
  tags: Tag[]
  created: Timestamp
  width: number
  height: number
}

export interface PuzzleInfo {
  table: PuzzleTable
  targetTiles: number
  imageUrl?: string // deprecated, use image.url instead
  image?: ImageInfo

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
  ts: Timestamp
}

export interface PuzzleStatus {
  finished: boolean
  duration: number
  piecesDone: number
  piecesTotal: number
}

export interface PlayerChange {
  id?: string
  x?: number
  y?: number
  d?: 0|1
  name?: string|null
  color?: string|null
  bgcolor?: string|null
  points?: number
  ts?: Timestamp
}

export enum ScoreMode {
  FINAL = 0,
  ANY = 1,
}

export enum ShapeMode {
  NORMAL = 0,
  ANY = 1,
  FLAT = 2,
}

export enum SnapMode {
  NORMAL = 0,
  REAL = 1,
}

export const DefaultScoreMode = (v: any): ScoreMode => {
  if (v === ScoreMode.FINAL || v === ScoreMode.ANY) {
    return v
  }
  return ScoreMode.FINAL
}

export const DefaultShapeMode = (v: any): ShapeMode => {
  if (v === ShapeMode.NORMAL || v === ShapeMode.ANY || v === ShapeMode.FLAT) {
    return v
  }
  return ShapeMode.NORMAL
}

export const DefaultSnapMode = (v: any): SnapMode => {
  if (v === SnapMode.NORMAL || v === SnapMode.REAL) {
    return v
  }
  return SnapMode.NORMAL
}
