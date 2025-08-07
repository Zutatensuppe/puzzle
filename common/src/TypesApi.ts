import type { Announcement, FeaturedRowWithCollections, GameId, GameInfo, GameSettings, ImageId, ImageInfo, Leaderboard, LivestreamsRow, Pagination, ReplayGameData, Tag, User } from './Types'

export type * as Admin from './TypesAdminApi'

export interface ApiGamesData {
  items: GameInfo[]
  pagination: Pagination
}

export interface ApiDataIndexData {
  gamesRunning: ApiGamesData
  gamesFinished: ApiGamesData
  leaderboards: Leaderboard[]
  livestreams: LivestreamsRow[]
}

export type FinishedGamesRequestData = {
  limit: number
  offset: number
}

export type FinishedGamesResponseData = ApiGamesData | {
  error: string
}

export interface NewGameDataRequestData {
  sort: string
  search: string
}

export type UploadRequestData = {
  file: Blob
  title: string
  copyrightName: string
  copyrightURL: string
  tags: string[]
  isPrivate: boolean
  isNsfw: boolean
}

export type UploadRequestDataWithProgress = UploadRequestData & {
  onProgress: (progress: number) => void
}

export type MeResponseData = User | { reason: string }

export type LogoutResponseData = {
  success: true
} | {
  reason: string
}

export type RegisterResponseData = {
  success: true
} | {
  reason: string
}

export type SendPasswordResetEmailResponseData = {
  success: true
} | {
  reason: string
}
export type ChangePasswordResponseData = {
  success: true
} | {
  reason: string
}

export type AuthLocalResponseData = {
  success: true
} | {
  reason: string
}

export type ConfigResponseData = {
  WS_ADDRESS: string
}

export interface NewGameDataResponseData {
  featured: FeaturedRowWithCollections[]
  images: ImageInfo[]
  tags: Tag[]
}

export type ReplayLogDataRequestData = {
  gameId: GameId
  logFileIdx: number
}

export type SaveImageRequestData = {
  id: ImageId
  title: string
  copyrightName: string
  copyrightURL: string
  tags: string[]
}

export type SaveImageResponseData = {
  ok: true
  imageInfo: ImageInfo
} | {
  ok: false
  error: string
}

export type NewGameRequestData = {
  gameSettings: GameSettings
}

export type NewGameResponseData = {
  id: GameId
} | {
  reason: string
}

export type FeaturedRequestData = {
  type: 'category' | 'artist'
  slug: string
}

export type FeaturedResponseData = {
  featured: FeaturedRowWithCollections
} | {
  reason: string
}

export type ReportImageRequestData = {
  id: ImageId
  reason: string
}

export type ReportGameRequestData = {
  id: GameId
  reason: string
}

export type ReportResponseData = {
  ok: true
} | {
  ok: false
  error: string
}

export interface FeaturedTeasersResponseData {
  featuredTeasers: FeaturedRowWithCollections[]
}

export interface ImagesRequestData {
  sort: string
  search: string
  offset: number
}

export interface ImagesResponseData {
  images: ImageInfo[]
}

export type AnnouncementsResponseData = Announcement[]

export type DeleteGameResponseData = {
  ok: true
} | {
  ok: false
  error: string
}

export type ReplayGameDataRequestData = {
  gameId: GameId
}

export type ReplayGameDataResponseData = ReplayGameData | {
  reason: string
}
