import type { Announcement, FeaturedRow, FeaturedRowWithCollections, FeaturedTeaserRow, FixPiecesResult, GameRowWithImageAndUser, ImageInfo, ImageRowWithCount, MergeClientIdsIntoUserResult, Pagination, UserGroupRow, UserRow } from './Types'

export type ErrorResponseData = {
  error: string
}

type AcknowledgeResponseData = {
  ok: true
}

export type GetGamesResponseData = {
  items: GameRowWithImageAndUser[]
  pagination: Pagination
} | ErrorResponseData

export type GetImagesResponseData = {
  items: ImageRowWithCount[]
  pagination: Pagination
} | ErrorResponseData

export type GetFeaturedsResponseData = {
  items: FeaturedRowWithCollections[]
} | ErrorResponseData

export type GetFeaturedTeasersResponseData = {
  items: FeaturedTeaserRow[]
} | ErrorResponseData

export type PostFeaturedTeasersResponseData = AcknowledgeResponseData

export type GetFeaturedResponseData = {
  featured: FeaturedRowWithCollections
} | ErrorResponseData

export type PostFeaturedsResponseData = {
  featured: FeaturedRow
} | { ok: false, reason: string }

export type PutFeaturedResponseData = AcknowledgeResponseData

export type DeleteGameResponseData = AcknowledgeResponseData

export type DeleteImageResponseData = AcknowledgeResponseData | ErrorResponseData

export type SetImagePrivateResponseData = AcknowledgeResponseData | ErrorResponseData

export type ApproveImageResponseData = AcknowledgeResponseData | ErrorResponseData

export type GetImageResponseData = {
  image: ImageInfo
} | ErrorResponseData

export type GetUsersResponseData = {
  items: UserRow[]
  pagination: Pagination
} | ErrorResponseData

export type PostUsersMergeClientIdsIntoUsersResponseData = MergeClientIdsIntoUserResult

export type PostGamesFixPiecesResponseData = FixPiecesResult

export type GetGroupsResponseData = UserGroupRow[]

export type GetAnnouncementsResponseData = Announcement[]

export type PostAnnouncementsResponseData = {
  announcement: Announcement
} | { ok: false, reason: string }
