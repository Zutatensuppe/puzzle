import { ClientId, FeaturedRowWithCollections, GameId, ImageId, ServerInfo, UserId } from '../../../common/src/Types'
import xhr, { JSON_HEADERS } from './xhr'
import Util from '../../../common/src/Util'
import { DeleteImageResponseData, GetAnnouncementsResponseData, GetFeaturedResponseData, GetFeaturedsResponseData, GetGroupsResponseData, GetImageResponseData, GetImagesResponseData, PostAnnouncementsResponseData, PostFeaturedsResponseData, PostGamesFixPiecesResponseData, PostUsersMergeClientIdsIntoUsersResponseData, PutFeaturedResponseData, type DeleteGameResponseData, type GetGamesResponseData, type GetUsersResponseData } from '../TypesAdminApi'

const getGames = async (data: {
  limit: number
  offset: number
}): Promise<GetGamesResponseData> => {
  const res = await xhr.get<GetGamesResponseData>(`/admin/api/games${Util.asQueryArgs(data)}`)
  return await res.json()
}

const deleteGame = async (
  id: GameId,
): Promise<DeleteGameResponseData> => {
  const res = await xhr.delete<DeleteGameResponseData>(`/admin/api/games/${id}`)
  return await res.json()
}

const getUsers = async (data: {
  limit: number
  offset: number
}): Promise<GetUsersResponseData> => {
  const res = await xhr.get<GetUsersResponseData>(`/admin/api/users${Util.asQueryArgs(data)}`)
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
): Promise<PostUsersMergeClientIdsIntoUsersResponseData> => {
  const res = await xhr.post<PostUsersMergeClientIdsIntoUsersResponseData>('/admin/api/users/_merge_client_ids_into_user', {
    headers: JSON_HEADERS,
    body: JSON.stringify({ userId, clientIds, dry }),
  })
  return await res.json()
}

const fixPieces = async (
  gameId: GameId,
): Promise<PostGamesFixPiecesResponseData> => {
  const res = await xhr.post<PostGamesFixPiecesResponseData>('/admin/api/games/_fix_pieces', {
    headers: JSON_HEADERS,
    body: JSON.stringify({ gameId }),
  })
  return await res.json()
}

const getAnnouncements = async (
  // no args
): Promise<GetAnnouncementsResponseData> => {
  const res = await xhr.get<GetAnnouncementsResponseData>('/admin/api/announcements')
  return await res.json()
}

const postAnnouncement = async (
  title: string,
  message: string,
): Promise<PostAnnouncementsResponseData> => {
  const res = await xhr.post<PostAnnouncementsResponseData>('/admin/api/announcements', {
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
}): Promise<GetImagesResponseData> => {
  const res = await xhr.get<GetImagesResponseData>(`/admin/api/images${Util.asQueryArgs(data)}`)
  return await res.json()
}

const getFeatureds = async (data: {
  limit: number
  offset: number
}): Promise<GetFeaturedsResponseData> => {
  const res = await xhr.get<GetFeaturedsResponseData>(`/admin/api/featureds${Util.asQueryArgs(data)}`)
  return await res.json()
}

const getFeatured = async (
  id: number,
): Promise<GetFeaturedResponseData> => {
  const res = await xhr.get<GetFeaturedResponseData>(`/admin/api/featureds/${id}`)
  return await res.json()
}

const saveFeatured = async (
  featured: FeaturedRowWithCollections,
): Promise<PutFeaturedResponseData> => {
  const res = await xhr.put<PutFeaturedResponseData>(`/admin/api/featureds/${featured.id}`, {
    headers: JSON_HEADERS,
    body: JSON.stringify({ featured }),
  })
  return await res.json()
}

const createFeatured = async (
  type: 'artist' | 'category',
  name: string,
  introduction: string,
  links: { url: string, title: string }[],
): Promise<PostFeaturedsResponseData> => {
  const res = await xhr.post<PostFeaturedsResponseData>('/admin/api/featureds', {
    headers: JSON_HEADERS,
    body: JSON.stringify({ type, name, introduction, links }),
  })
  return await res.json()
}

const deleteImage = async (
  id: ImageId,
): Promise<DeleteImageResponseData> => {
  const res = await xhr.delete<DeleteImageResponseData>(`/admin/api/images/${id}`)
  return await res.json()
}

const getImage = async (
  id: ImageId,
): Promise<GetImageResponseData> => {
  const res = await xhr.get<GetImageResponseData>(`/admin/api/images/${id}`)
  return await res.json()
}

const getGroups = async (
  // no args
): Promise<GetGroupsResponseData> => {
  const res = await xhr.get<GetGroupsResponseData>('/admin/api/groups')
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
  createFeatured,
  saveFeatured,
  getImages,
  getImage,
  deleteImage,
  getGroups,
  getServerInfo,
  mergeClientIdsIntoUser,
  fixPieces,
}
