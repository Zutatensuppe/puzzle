import type {
  Api,
  ClientId,
  FeaturedRowWithCollections,
  FeaturedTeaserRow,
  GameId,
  ImageId,
  ServerInfo,
  UserId,
} from '@common/Types'
import xhr, { JSON_HEADERS } from './xhr'
import Util from '@common/Util'

const getGames = async (data: {
  limit: number
  offset: number
}): Promise<Api.Admin.GetGamesResponseData> => {
  const res = await xhr.get<Api.Admin.GetGamesResponseData>(`/admin/api/games${Util.asQueryArgs(data)}`)
  return await res.json()
}

const deleteGame = async (
  id: GameId,
): Promise<Api.Admin.DeleteGameResponseData> => {
  const res = await xhr.delete<Api.Admin.DeleteGameResponseData>(`/admin/api/games/${id}`)
  return await res.json()
}

const getUsers = async (data: {
  limit: number
  offset: number
}): Promise<Api.Admin.GetUsersResponseData> => {
  const res = await xhr.get<Api.Admin.GetUsersResponseData>(`/admin/api/users${Util.asQueryArgs(data)}`)
  return await res.json()
}

const getServerInfo = async (
  // no args
): Promise<ServerInfo> => {
  const res = await xhr.get<ServerInfo>('/admin/api/server-info')
  return await res.json()
}

const mergeClientIdsIntoUser = async (
  userId: UserId,
  clientIds: ClientId[],
  dry: boolean,
): Promise<Api.Admin.PostUsersMergeClientIdsIntoUsersResponseData> => {
  const res = await xhr.post<Api.Admin.PostUsersMergeClientIdsIntoUsersResponseData>('/admin/api/users/_merge_client_ids_into_user', {
    headers: JSON_HEADERS,
    body: JSON.stringify({ userId, clientIds, dry }),
  })
  return await res.json()
}

const fixPieces = async (
  gameId: GameId,
): Promise<Api.Admin.PostGamesFixPiecesResponseData> => {
  const res = await xhr.post<Api.Admin.PostGamesFixPiecesResponseData>('/admin/api/games/_fix_pieces', {
    headers: JSON_HEADERS,
    body: JSON.stringify({ gameId }),
  })
  return await res.json()
}

const getAnnouncements = async (
  // no args
): Promise<Api.Admin.GetAnnouncementsResponseData> => {
  const res = await xhr.get<Api.Admin.GetAnnouncementsResponseData>('/admin/api/announcements')
  return await res.json()
}

const postAnnouncement = async (
  title: string,
  message: string,
): Promise<Api.Admin.PostAnnouncementsResponseData> => {
  const res = await xhr.post<Api.Admin.PostAnnouncementsResponseData>('/admin/api/announcements', {
    headers: JSON_HEADERS,
    body: JSON.stringify({ title, message }),
  })
  return await res.json()
}

const getImages = async (data: {
  limit: number
  offset: number
  ids?: ImageId[]
  tags?: string[]
  uploaderUserId?: UserId
}): Promise<Api.Admin.GetImagesResponseData> => {
  const res = await xhr.get<Api.Admin.GetImagesResponseData>(`/admin/api/images${Util.asQueryArgs(data)}`)
  return await res.json()
}

const getPendingImages = async (data: {
  limit: number
  offset: number
}): Promise<Api.Admin.GetImagesResponseData> => {
  const res = await xhr.get<Api.Admin.GetImagesResponseData>(`/admin/api/images/pending${Util.asQueryArgs(data)}`)
  return await res.json()
}

const getFeatureds = async (
  // no args
): Promise<Api.Admin.GetFeaturedsResponseData> => {
  const res = await xhr.get<Api.Admin.GetFeaturedsResponseData>('/admin/api/featureds')
  return await res.json()
}

const getFeaturedTeasers = async (
  // no args
): Promise<Api.Admin.GetFeaturedTeasersResponseData> => {
  const res = await xhr.get<Api.Admin.GetFeaturedTeasersResponseData>('/admin/api/featured-teasers')
  return await res.json()
}

const saveFeaturedTeasers = async (
  featuredTeasers: FeaturedTeaserRow[],
): Promise<Api.Admin.PostFeaturedTeasersResponseData> => {
  const res = await xhr.post<Api.Admin.PostFeaturedTeasersResponseData>('/admin/api/featured-teasers', {
    headers: JSON_HEADERS,
    body: JSON.stringify({ featuredTeasers }),
  })
  return await res.json()
}

const getFeatured = async (
  id: number,
): Promise<Api.Admin.GetFeaturedResponseData> => {
  const res = await xhr.get<Api.Admin.GetFeaturedResponseData>(`/admin/api/featureds/${id}`)
  return await res.json()
}

const saveFeatured = async (
  featured: FeaturedRowWithCollections,
): Promise<Api.Admin.PutFeaturedResponseData> => {
  const res = await xhr.put<Api.Admin.PutFeaturedResponseData>(`/admin/api/featureds/${featured.id}`, {
    headers: JSON_HEADERS,
    body: JSON.stringify({ featured }),
  })
  return await res.json()
}

const createFeatured = async (
  featured: FeaturedRowWithCollections,
): Promise<Api.Admin.PostFeaturedsResponseData> => {
  const res = await xhr.post<Api.Admin.PostFeaturedsResponseData>('/admin/api/featureds', {
    headers: JSON_HEADERS,
    body: JSON.stringify({
      type: featured.type,
      name: featured.name,
      slug: featured.slug,
      introduction: featured.introduction,
      links: featured.links,
    }),
  })
  return await res.json()
}

const deleteImage = async (
  id: ImageId,
): Promise<Api.Admin.DeleteImageResponseData> => {
  const res = await xhr.delete<Api.Admin.DeleteImageResponseData>(`/admin/api/images/${id}`)
  return await res.json()
}

const setImagePrivate = async (
  id: ImageId,
  value: boolean,
): Promise<Api.Admin.SetImagePrivateResponseData> => {
  const res = await xhr.post<Api.Admin.SetImagePrivateResponseData>(`/admin/api/images/${id}/_set_private`, {
    headers: JSON_HEADERS,
    body: JSON.stringify({ value }),
  })
  return await res.json()
}

const approveImage = async (
  id: ImageId,
): Promise<Api.Admin.ApproveImageResponseData> => {
  const res = await xhr.post<Api.Admin.ApproveImageResponseData>(`/admin/api/images/${id}/_approve`, {
    headers: JSON_HEADERS,
  })
  return await res.json()
}

const rejectImage = async (
  id: ImageId,
  reason?: string,
): Promise<Api.Admin.RejectImageResponseData> => {
  const res = await xhr.post<Api.Admin.RejectImageResponseData>(`/admin/api/images/${id}/_reject`, {
    headers: JSON_HEADERS,
    body: JSON.stringify({ reason: reason || '' }),
  })
  return await res.json()
}

const getCurationQueue = async (topic: string, maxPasses: number): Promise<Api.Admin.GetCurationQueueResponseData> => {
  const params = new URLSearchParams({ topic, maxPasses: String(maxPasses) })
  const res = await xhr.get<Api.Admin.GetCurationQueueResponseData>(`/admin/api/images/curation-queue?${params}`)
  return await res.json()
}

const curateImage = async (
  id: ImageId,
  topic: string,
  decision: 'yes' | 'no',
): Promise<Api.Admin.CurateImageResponseData> => {
  const res = await xhr.post<Api.Admin.CurateImageResponseData>(`/admin/api/images/${id}/_curate`, {
    headers: JSON_HEADERS,
    body: JSON.stringify({ topic, decision }),
  })
  return await res.json()
}

const setImageAiGenerated = async (
  id: ImageId,
  value: number,
): Promise<Api.Admin.SetImageAiGeneratedResponseData> => {
  const res = await xhr.post<Api.Admin.SetImageAiGeneratedResponseData>(`/admin/api/images/${id}/_set_ai_generated`, {
    headers: JSON_HEADERS,
    body: JSON.stringify({ value }),
  })
  return await res.json()
}

const setImageNsfw = async (
  id: ImageId,
  value: boolean,
): Promise<Api.Admin.SetImageNsfwResponseData> => {
  const res = await xhr.post<Api.Admin.SetImageNsfwResponseData>(`/admin/api/images/${id}/_set_nsfw`, {
    headers: JSON_HEADERS,
    body: JSON.stringify({ value }),
  })
  return await res.json()
}

const detectAiImages = async (): Promise<Api.Admin.DetectAiImagesResponseData> => {
  const res = await xhr.post<Api.Admin.DetectAiImagesResponseData>('/admin/api/tools/detect-ai', {
    headers: JSON_HEADERS,
  })
  return await res.json()
}

const getImage = async (
  id: ImageId,
): Promise<Api.Admin.GetImageResponseData> => {
  const res = await xhr.get<Api.Admin.GetImageResponseData>(`/admin/api/images/${id}`)
  return await res.json()
}

const getGroups = async (
  // no args
): Promise<Api.Admin.GetGroupsResponseData> => {
  const res = await xhr.get<Api.Admin.GetGroupsResponseData>('/admin/api/groups')
  return await res.json()
}

const getUploaders = async (data: {
  limit: number
  offset: number
}): Promise<Api.Admin.GetUploadersResponseData> => {
  const res = await xhr.get<Api.Admin.GetUploadersResponseData>(`/admin/api/uploaders${Util.asQueryArgs(data)}`)
  return await res.json()
}

const trustUser = async (
  id: UserId,
): Promise<Api.Admin.SetUserTrustResponseData> => {
  const res = await xhr.post<Api.Admin.SetUserTrustResponseData>(`/admin/api/users/${id}/_trust`, {
    headers: JSON_HEADERS,
  })
  return await res.json()
}

const untrustUser = async (
  id: UserId,
): Promise<Api.Admin.SetUserTrustResponseData> => {
  const res = await xhr.post<Api.Admin.SetUserTrustResponseData>(`/admin/api/users/${id}/_untrust`, {
    headers: JSON_HEADERS,
  })
  return await res.json()
}

const resetUserTrust = async (
  id: UserId,
): Promise<Api.Admin.SetUserTrustResponseData> => {
  const res = await xhr.post<Api.Admin.SetUserTrustResponseData>(`/admin/api/users/${id}/_reset_trust`, {
    headers: JSON_HEADERS,
  })
  return await res.json()
}

const recomputeTrust = async (): Promise<Api.Admin.RecomputeTrustResponseData> => {
  const res = await xhr.post<Api.Admin.RecomputeTrustResponseData>('/admin/api/uploaders/_recompute_trust', {
    headers: JSON_HEADERS,
  })
  return await res.json()
}

export default {
  getAnnouncements,
  postAnnouncement,
  getGames,
  deleteGame,
  getUsers,
  getFeatured,
  getFeatureds,
  getFeaturedTeasers,
  createFeatured,
  saveFeatured,
  saveFeaturedTeasers,
  getImages,
  getPendingImages,
  getImage,
  deleteImage,
  setImagePrivate,
  approveImage,
  rejectImage,
  getCurationQueue,
  curateImage,
  setImageAiGenerated,
  setImageNsfw,
  detectAiImages,
  getGroups,
  getServerInfo,
  mergeClientIdsIntoUser,
  fixPieces,
  getUploaders,
  trustUser,
  untrustUser,
  resetUserTrust,
  recomputeTrust,
}
