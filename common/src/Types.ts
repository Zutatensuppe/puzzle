import { Rect } from './Geometry'
import { SERVER_EVENT_TYPE, LOG_TYPE, CLIENT_EVENT_TYPE, CHANGE_TYPE, GAME_EVENT_TYPE } from './Protocol'
import { Rng, RngSerialized } from './Rng'

// @see https://stackoverflow.com/a/59906630/392905
type ArrayLengthMutationKeys = 'splice' | 'push' | 'pop' | 'shift' | 'unshift' | number
type ArrayItems<T extends Array<any>> = T extends Array<infer TItems> ? TItems : never
export type FixedLengthArray<T extends any[]> =
  Pick<T, Exclude<keyof T, ArrayLengthMutationKeys>>
  & { [Symbol.iterator]: () => IterableIterator<ArrayItems<T>> }

export type Timestamp = number

declare const __brand: unique symbol
type Brand<B> = { [__brand]: B }
type Branded<T, B> = T & Brand<B>

export type GameId = Branded<string, 'GameId'>
export type ClientId = Branded<string, 'ClientId'>
export type UserId = Branded<number, 'UserId'>
export type IdentityId = Branded<number, 'IdentityId'>
export type UserGroupId = Branded<number, 'UserGroupId'>
export type AccountId = Branded<number, 'AccountId'>
export type ImageId = Branded<number, 'ImageId'>
export type AnnouncementId = Branded<number, 'AnnouncementId'>
export type TagId = Branded<number, 'TagId'>
export type LeaderboardId = Branded<number, 'LeaderboardId'>
export type LivestreamId = Branded<string, 'LivestreamId'>

export type ChangePiece = [CHANGE_TYPE.PIECE, EncodedPiece]
export type ChangePlayer = [CHANGE_TYPE.PLAYER, EncodedPlayer]
export type ChangeData = [CHANGE_TYPE.DATA, PuzzleData]
export type ChangePlayerSnap = [CHANGE_TYPE.PLAYER_SNAP, string]
export type Change = ChangePiece | ChangePlayer | ChangeData | ChangePlayerSnap

export type GameEventInputMouseDown = [GAME_EVENT_TYPE.INPUT_EV_MOUSE_DOWN, number, number]
export type GameEventInputMouseUp = [GAME_EVENT_TYPE.INPUT_EV_MOUSE_UP, number, number]
export type GameEventInputMouseMove = [GAME_EVENT_TYPE.INPUT_EV_MOUSE_MOVE, number, number, number, number, 0 | 1]
export type GameEventInputZoomIn = [GAME_EVENT_TYPE.INPUT_EV_ZOOM_IN, number, number]
export type GameEventInputZoomOut = [GAME_EVENT_TYPE.INPUT_EV_ZOOM_OUT, number, number]
export type GameEventInputBgColor = [GAME_EVENT_TYPE.INPUT_EV_BG_COLOR, string]
export type GameEventInputPlayerColor = [GAME_EVENT_TYPE.INPUT_EV_PLAYER_COLOR, string]
export type GameEventInputPlayerName = [GAME_EVENT_TYPE.INPUT_EV_PLAYER_NAME, string]
export type GameEventInputMove = [GAME_EVENT_TYPE.INPUT_EV_MOVE, number, number]
export type GameEventInputRotate = [GAME_EVENT_TYPE.INPUT_EV_ROTATE, number]
export type GameEventInputTogglePreview = [GAME_EVENT_TYPE.INPUT_EV_TOGGLE_PREVIEW]
export type GameEventInputToggleSounds = [GAME_EVENT_TYPE.INPUT_EV_TOGGLE_SOUNDS]
export type GameEventInputReplayTogglePause = [GAME_EVENT_TYPE.INPUT_EV_REPLAY_TOGGLE_PAUSE]
export type GameEventInputReplaySpeedUp = [GAME_EVENT_TYPE.INPUT_EV_REPLAY_SPEED_UP]
export type GameEventInputReplaySpeedDown = [GAME_EVENT_TYPE.INPUT_EV_REPLAY_SPEED_DOWN]
export type GameEventInputTogglePlayerNames = [GAME_EVENT_TYPE.INPUT_EV_TOGGLE_PLAYER_NAMES]
export type GameEventInputCenterFitPuzzle = [GAME_EVENT_TYPE.INPUT_EV_CENTER_FIT_PUZZLE]
export type GameEventInputToggleFixedPieces = [GAME_EVENT_TYPE.INPUT_EV_TOGGLE_FIXED_PIECES]
export type GameEventInputToggleLoosePieces = [GAME_EVENT_TYPE.INPUT_EV_TOGGLE_LOOSE_PIECES]
export type GameEventInputStorePos = [GAME_EVENT_TYPE.INPUT_EV_STORE_POS, number]
export type GameEventInputRestorePos = [GAME_EVENT_TYPE.INPUT_EV_RESTORE_POS, number]
export type GameEventInputConnectionClose = [GAME_EVENT_TYPE.INPUT_EV_CONNECTION_CLOSE]
export type GameEventInputToggleTable = [GAME_EVENT_TYPE.INPUT_EV_TOGGLE_TABLE]
export type GameEventInputToggleInterface = [GAME_EVENT_TYPE.INPUT_EV_TOGGLE_INTERFACE]
export type GameEvent = GameEventInputMouseDown
  | GameEventInputMouseUp
  | GameEventInputMouseMove
  | GameEventInputZoomIn
  | GameEventInputZoomOut
  | GameEventInputBgColor
  | GameEventInputPlayerColor
  | GameEventInputPlayerName
  | GameEventInputMove
  | GameEventInputRotate
  | GameEventInputTogglePreview
  | GameEventInputToggleSounds
  | GameEventInputReplayTogglePause
  | GameEventInputReplaySpeedUp
  | GameEventInputReplaySpeedDown
  | GameEventInputTogglePlayerNames
  | GameEventInputCenterFitPuzzle
  | GameEventInputToggleFixedPieces
  | GameEventInputToggleLoosePieces
  | GameEventInputStorePos
  | GameEventInputRestorePos
  | GameEventInputConnectionClose
  | GameEventInputToggleTable
  | GameEventInputToggleInterface

export type ServerInitEvent = [SERVER_EVENT_TYPE.INIT, EncodedGame | EncodedGameLegacy]
export type ServerUpdateEvent = [SERVER_EVENT_TYPE.UPDATE, string, number, Change[]]
export type ServerSyncEvent = [SERVER_EVENT_TYPE.SYNC, EncodedGame | EncodedGameLegacy]
export type ServerEvent = ServerInitEvent | ServerUpdateEvent | ServerSyncEvent

export type ClientInitEvent = [CLIENT_EVENT_TYPE.INIT]
export type ClientUpdateEvent = [CLIENT_EVENT_TYPE.UPDATE, number, GameEvent]
export type ClientImageSnapshotEvent = [CLIENT_EVENT_TYPE.IMAGE_SNAPSHOT, string, number]
export type ClientEvent = ClientInitEvent | ClientUpdateEvent | ClientImageSnapshotEvent

export enum EncodedPlayerIdx {
  ID = 0,
  X = 1,
  Y = 2,
  MOUSEDOWN = 3,
  NAME = 4,
  COLOR = 5,
  BGCOLOR = 6,
  POINTS = 7,
  TIMESTAMP = 8,
}

export type EncodedPlayer = FixedLengthArray<[
  EncodedPlayerIdx.ID extends 0 ? ClientId : never,
  EncodedPlayerIdx.X extends 1 ? number : never,
  EncodedPlayerIdx.Y extends 2 ? number : never,
  EncodedPlayerIdx.MOUSEDOWN extends 3 ? 0 | 1 : never,
  EncodedPlayerIdx.NAME extends 4 ? string | null : never,
  EncodedPlayerIdx.COLOR extends 5 ? string | null : never,
  EncodedPlayerIdx.BGCOLOR extends 6 ? string | null : never,
  EncodedPlayerIdx.POINTS extends 7 ? number : never,
  EncodedPlayerIdx.TIMESTAMP extends 8 ? Timestamp : never,
]>

export type RegisteredMap = Record<ClientId, boolean>

export enum PieceRotation {
  R0 = 0,
  R90 = 1,
  R180 = 2,
  R270 = 3,
}

export enum EncodedPieceIdx {
  IDX = 0,
  POS_X = 1,
  POS_Y = 2,
  Z = 3,
  OWNER = 4,
  GROUP = 5,
  ROTATION = 6,
}

export type EncodedPiece = FixedLengthArray<[
  EncodedPieceIdx.IDX extends 0 ? number : never,
  EncodedPieceIdx.POS_X extends 1 ? number : never,
  EncodedPieceIdx.POS_Y extends 2 ? number : never,
  EncodedPieceIdx.Z extends 3 ? number : never,
  EncodedPieceIdx.OWNER extends 4 ? ClientId | number : never,
  EncodedPieceIdx.GROUP extends 5 ? number : never,
  EncodedPieceIdx.ROTATION extends 6 ? undefined|PieceRotation : never,
]>

export interface Announcement {
  id: AnnouncementId
  created: string // date string
  title: string
  message: string
}

export type EncodedPieceShape = number

export type EncodedGameLegacy = FixedLengthArray<[
  GameId,
  string,
  RngSerialized,
  Puzzle,
  Array<EncodedPlayer>,
  ScoreMode,
  ShapeMode,
  SnapMode,
  UserId | null,
  boolean, // has replay
  number, // gameVersion
  boolean, // private
]>

export type EncodedGame = FixedLengthArray<[
  GameId,
  string,
  RngSerialized,
  Puzzle,
  Array<EncodedPlayer>,
  ScoreMode,
  ShapeMode,
  SnapMode,
  UserId | null,
  boolean, // has replay
  number, // gameVersion
  boolean, // private
  Rect, // crop
  RegisteredMap,
  RotationMode | undefined,
]>

export type HeaderLogEntry = [
  LOG_TYPE.HEADER,
  number, // gameObject.gameVersion,
  number, // gameSettings.tiles,
  ImageInfo, // gameSettings.image,
  Timestamp, // ts,
  ScoreMode, // gameObject.scoreMode,
  ShapeMode, // gameObject.shapeMode,
  SnapMode, // gameObject.snapMode,
  number | null, // gameObject.creatorUserId,
  1 | 0, // gameObject.private ? 1 : 0,
  Rect | undefined, // gameSettings.crop,
]

export type AddPlayerLogEntry = [
  LOG_TYPE.ADD_PLAYER,
  string, // playerId,
  Timestamp, // ts
]

export type UpdatePlayerLogEntry = [
  LOG_TYPE.UPDATE_PLAYER,
  number, // player index,
  Timestamp, // ts
]

export type HandleGameEventLogEntry = [
  LOG_TYPE.GAME_EVENT,
  number, // player index,
  GameEvent, // input,
  Timestamp, // ts
]

export type LogEntry = HeaderLogEntry | HandleGameEventLogEntry | UpdatePlayerLogEntry | AddPlayerLogEntry

export interface ReplayGameData {
  game: EncodedGame
}

export interface Tag {
  id: TagId
  slug: string
  title: string
  total: number
}

interface GameRng {
  obj: Rng
  type?: string
}

export interface Game {
  id: GameId
  gameVersion: number
  creatorUserId: UserId | null
  players: Array<EncodedPlayer>
  puzzle: Puzzle
  scoreMode: ScoreMode
  shapeMode: ShapeMode
  snapMode: SnapMode
  rotationMode: RotationMode
  rng: GameRng
  private: boolean
  hasReplay: boolean
  crop?: Rect
  registeredMap: RegisteredMap
}

export interface Image {
  id: ImageId
  filename: string
  file: string
  url: string
  title: string
  tags: Array<Tag>
  created: number
}

export interface FrontendGameSettings {
  file: File
  title: string
  copyrightName: string
  copyrightURL: string
  tags: string[]
  isPrivate: boolean
}

export interface GameSettings {
  tiles: number
  private: boolean
  image: ImageInfo
  scoreMode: ScoreMode
  shapeMode: ShapeMode
  snapMode: SnapMode
  rotationMode: RotationMode
  crop: Rect
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

export interface PieceChange {
  [EncodedPieceIdx.OWNER]?: ClientId | number
  [EncodedPieceIdx.IDX]?: number
  [EncodedPieceIdx.POS_X]?: number
  [EncodedPieceIdx.POS_Y]?: number
  [EncodedPieceIdx.Z]?: number
  [EncodedPieceIdx.GROUP]?: number
  [EncodedPieceIdx.ROTATION]?: PieceRotation
}

export interface ImageInfo {
  id: ImageId
  uploaderUserId: UserId | null
  uploaderName: string | null
  filename: string
  url: string
  title: string
  tags: Tag[]
  created: Timestamp
  width: number
  height: number
  gameCount: number
  private: boolean
  copyrightName: string
  copyrightURL: string
}

export interface PuzzleInfo {
  table: PuzzleTable
  targetTiles: number
  image: ImageInfo

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
  id: ClientId
  x: number
  y: number
  d: 0 | 1
  name: string | null
  color: string | null
  bgcolor: string | null
  points: number
  ts: Timestamp
}

export interface BasicPlayerInfo {
  id: ClientId
  name: string | null
  color: string | null
  points: number
}

export enum RendererType {
  CANVAS = 'canvas',
  WEBGL2 = 'webgl2',
}

export interface PlayerSettingsData {
  background: string
  color: string
  customTableTexture: string
  customTableTextureScale: number
  mouseRotate: boolean
  name: string
  otherPlayerClickSoundEnabled: boolean
  renderer: RendererType
  rotateSoundEnabled: boolean
  showPlayerNames: boolean
  showTable: boolean
  soundsEnabled: boolean
  soundsVolume: number
  tableTexture: string
  useCustomTableTexture: boolean
}

export const PLAYER_SETTINGS = {
  COLOR_BACKGROUND: 'bg_color',
  CUSTOM_TABLE_TEXTURE_SCALE: 'custom_table_texture_scale',
  CUSTOM_TABLE_TEXTURE: 'custom_table_texture',
  MOUSE_ROTATE: 'mouse_rotate',
  OTHER_PLAYER_CLICK_SOUND_ENABLED: 'other_player_click_sound_enabled',
  PLAYER_COLOR: 'player_color',
  PLAYER_NAME: 'player_name',
  RENDERER: 'renderer',
  ROTATE_SOUND_ENABLED: 'rotate_sound_enabled',
  SHOW_PLAYER_NAMES: 'show_player_names',
  SHOW_TABLE: 'show_table',
  SOUND_ENABLED: 'sound_enabled',
  SOUND_VOLUME: 'sound_volume',
  TABLE_TEXTURE: 'table_texture',
  USE_CUSTOM_TABLE_TEXTURE: 'use_custom_table_texture',
}

export const PLAYER_SETTINGS_DEFAULTS = {
  COLOR_BACKGROUND: '#222222',
  CUSTOM_TABLE_TEXTURE_SCALE: 1.0,
  CUSTOM_TABLE_TEXTURE: '',
  MOUSE_ROTATE: true,
  OTHER_PLAYER_CLICK_SOUND_ENABLED: true,
  PLAYER_COLOR: '#ffffff',
  PLAYER_NAME: 'anon',
  RENDERER: RendererType.WEBGL2,
  ROTATE_SOUND_ENABLED: true,
  SHOW_PLAYER_NAMES: true,
  SHOW_TABLE: true,
  SOUND_ENABLED: true,
  SOUND_VOLUME: 100,
  TABLE_TEXTURE: 'dark',
  USE_CUSTOM_TABLE_TEXTURE: false,
}

export const createDefaultPlayerSettingsData = (): PlayerSettingsData => ({
  background: PLAYER_SETTINGS_DEFAULTS.COLOR_BACKGROUND,
  color: PLAYER_SETTINGS_DEFAULTS.PLAYER_COLOR,
  customTableTexture: PLAYER_SETTINGS_DEFAULTS.CUSTOM_TABLE_TEXTURE,
  customTableTextureScale: PLAYER_SETTINGS_DEFAULTS.CUSTOM_TABLE_TEXTURE_SCALE,
  mouseRotate: PLAYER_SETTINGS_DEFAULTS.MOUSE_ROTATE,
  name: PLAYER_SETTINGS_DEFAULTS.PLAYER_NAME,
  otherPlayerClickSoundEnabled: PLAYER_SETTINGS_DEFAULTS.OTHER_PLAYER_CLICK_SOUND_ENABLED,
  renderer: PLAYER_SETTINGS_DEFAULTS.RENDERER,
  rotateSoundEnabled: PLAYER_SETTINGS_DEFAULTS.ROTATE_SOUND_ENABLED,
  showPlayerNames: PLAYER_SETTINGS_DEFAULTS.SHOW_PLAYER_NAMES,
  showTable: PLAYER_SETTINGS_DEFAULTS.SHOW_TABLE,
  soundsEnabled: PLAYER_SETTINGS_DEFAULTS.SOUND_ENABLED,
  soundsVolume: PLAYER_SETTINGS_DEFAULTS.SOUND_VOLUME,
  tableTexture: PLAYER_SETTINGS_DEFAULTS.TABLE_TEXTURE,
  useCustomTableTexture: PLAYER_SETTINGS_DEFAULTS.USE_CUSTOM_TABLE_TEXTURE,
})

export interface GameStatus {
  finished: boolean
  duration: number
  piecesDone: number
  piecesTotal: number
}

export interface PuzzleStatusInterface {
  update(ts: number): void
}

export interface PlayerChange {
  [EncodedPlayerIdx.ID]?: string
  [EncodedPlayerIdx.X]?: number
  [EncodedPlayerIdx.Y]?: number
  [EncodedPlayerIdx.MOUSEDOWN]?: 0 | 1
  [EncodedPlayerIdx.NAME]?: string | null
  [EncodedPlayerIdx.COLOR]?: string | null
  [EncodedPlayerIdx.BGCOLOR]?: string | null
  [EncodedPlayerIdx.POINTS]?: number
  [EncodedPlayerIdx.TIMESTAMP]?: Timestamp
}

export interface FireworksInterface {
  init(): void
  update(): void
  render(): void
  resizeBound: () => void // bound function
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

export enum RotationMode {
  NONE = 0,
  ORTHOGONAL = 1, // rotation only at 0, 90, 180, 270 degrees
}

export const DefaultScoreMode = (v: unknown): ScoreMode => {
  if (v === ScoreMode.FINAL || v === ScoreMode.ANY) {
    return v
  }
  return ScoreMode.FINAL
}

export const DefaultShapeMode = (v: unknown): ShapeMode => {
  if (v === ShapeMode.NORMAL || v === ShapeMode.ANY || v === ShapeMode.FLAT) {
    return v
  }
  return ShapeMode.NORMAL
}

export const DefaultSnapMode = (v: unknown): SnapMode => {
  if (v === SnapMode.NORMAL || v === SnapMode.REAL) {
    return v
  }
  return SnapMode.NORMAL
}

export const DefaultRotationMode = (v: unknown): RotationMode => {
  if (v === RotationMode.ORTHOGONAL) {
    return v
  }
  return RotationMode.NONE
}

export interface ImageSnapshot {
  url: string
}

export interface ImageSnapshots {
  current: ImageSnapshot | null
}

export interface GameInfo {
  id: GameId
  hasReplay: boolean
  isPrivate: boolean
  started: number
  finished: number
  piecesFinished: number
  piecesTotal: number
  players: number
  image: ImageInfo
  imageSnapshots: ImageSnapshots
  snapMode: SnapMode
  scoreMode: ScoreMode
  shapeMode: ShapeMode
  rotationMode: RotationMode
}

export interface Pagination {
  limit: number
  offset: number
  total: number
}

export interface ApiGamesData {
  items: GameInfo[]
  pagination: Pagination
}

export interface Leaderboard {
  id: LeaderboardId
  name: string
  entries: LeaderboardEntry[]
  userEntry: LeaderboardEntry | null
}

export interface LeaderboardEntry {
  leaderboard_id: LeaderboardId
  rank: number
  user_id: UserId
  user_name: string
  games_count: number
  pieces_count: number
}

export interface TwitchLivestream {
  id: LivestreamId
  title: string
  url: string
  user_display_name: string
  user_thumbnail: string
  language: string
  viewers: number
}

export interface LivestreamsRow {
  id: number
  is_live: number
  livestream_id: LivestreamId
  title: string
  url: string
  user_display_name: string
  user_thumbnail: string
  language: string
  viewers: number
}

export interface ApiDataIndexData {
  gamesRunning: ApiGamesData
  gamesFinished: ApiGamesData
  leaderboards: Leaderboard[]
  livestreams: LivestreamsRow[]
}

export type ApiDataFinishedGames = ApiGamesData

export interface CannyConfig {
  sso_private_key: string
}

export interface TwitchConfig {
  client_id: string
  client_secret: string
}

export interface MailConfig {
  sendinblue_api_key: string
}

export interface DiscordConfig {
  bot: {
    url: string
    token: string
  }
  announce: {
    guildId: string
    channelId: string
  }
}

export interface TokenRow {
  user_id: UserId | AccountId
  type: string
  token: string
}

interface MailServiceUser {
  email: string
  name: string
}

export interface MailServicePasswordResetData {
  user: MailServiceUser
  token: TokenRow
}

export interface MailServiceRegistrationData {
  user: MailServiceUser
  token: TokenRow
}

export interface MailService {
  sendPasswordResetMail: (data: MailServicePasswordResetData) => any
  sendRegistrationMail: (data: MailServiceRegistrationData) => any
}

export interface GamePlayers {
  active: BasicPlayerInfo[]
  idle: BasicPlayerInfo[]
}

export enum CONN_STATE {
  NOT_CONNECTED = 0, // not connected yet
  DISCONNECTED = 1, // not connected, but was connected before
  CONNECTED = 2, // connected
  CONNECTING = 3, // connecting
  CLOSED = 4, // not connected (closed on purpose)
}

export interface Hud {
  setPuzzleCut: () => void
  setPlayers: (v: GamePlayers, r: RegisteredMap) => void
  setStatus: (v: GameStatus) => void
  setConnectionState: (v: CONN_STATE) => void
  togglePreview: (v: boolean) => void
  toggleInterface: (v: boolean) => void
  addStatusMessage: (what: string, value: any) => void
}

export interface ReplayHud extends Hud {
  setReplaySpeed: (v: number) => void
  setReplayPaused: (v: boolean) => void
  setReplayFinished: () => void
}

export interface NewGameDataRequestData {
  sort: string
  search: string
}

export interface ImagesRequestData {
  sort: string
  search: string
  offset: number
}

export enum ImageSearchSort {
  ALPHA_ASC = 'alpha_asc',
  ALPHA_DESC = 'alpha_desc',
  DATE_ASC = 'date_asc',
  DATE_DESC = 'date_desc',
  GAME_COUNT_ASC = 'game_count_asc',
  GAME_COUNT_DESC = 'game_count_desc',
}

export const isImageSearchSort = (sort: unknown): sort is ImageSearchSort => {
  return typeof sort === 'string' && [
    'alpha_asc',
    'alpha_desc',
    'date_asc',
    'date_desc',
    'game_count_asc',
    'game_count_desc',
  ].includes(sort)
}

export interface HandleGameEventResult {
  changes: Change[]
  anySnapped: boolean
  anyDropped: boolean
  anyRotated: boolean
}

export interface MergeClientIdsIntoUserResult {
  dry: boolean
  updatedGameIds: GameId[]
  updatedImageIds: ImageId[]
  removedUserIds: UserId[]
  userIdsWithIdentities: UserId[]
  userIdsWithoutIdentities: UserId[]
}

export interface LogIndex {
  gameId: GameId
  total: number
  lastTs: Timestamp
  currentFile: string
  perFile: number
}

export type GameLogInfoByGameIds = Record<GameId, {
  logIndex: LogIndex
  logEntriesToFlush: number
}>

export interface ServerInfo {
  socketCount: number
  socketCountsByGameIds: Record<GameId, number>
  gameLogInfoByGameIds: GameLogInfoByGameIds
}
