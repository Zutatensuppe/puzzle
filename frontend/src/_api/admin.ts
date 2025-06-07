import {
  Api,
  ClientId,
  FeaturedRowWithCollections,
  GameId,
  ImageId,
  ServerInfo,
  UserId,
} from '../../../common/src/Types'
import xhr, { JSON_HEADERS } from './xhr'
import Util from '../../../common/src/Util'

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
}): Promise<Api.Admin.GetImagesResponseData> => {
  const res = await xhr.get<Api.Admin.GetImagesResponseData>(`/admin/api/images${Util.asQueryArgs(data)}`)
  return await res.json()
}

const getFeatureds = async (data: {
  limit: number
  offset: number
}): Promise<Api.Admin.GetFeaturedsResponseData> => {
  const res = await xhr.get<Api.Admin.GetFeaturedsResponseData>(`/admin/api/featureds${Util.asQueryArgs(data)}`)
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
  type: 'artist' | 'category',
  name: string,
  introduction: string,
  links: { url: string, title: string }[],
): Promise<Api.Admin.PostFeaturedsResponseData> => {
  const res = await xhr.post<Api.Admin.PostFeaturedsResponseData>('/admin/api/featureds', {
    headers: JSON_HEADERS,
    body: JSON.stringify({ type, name, introduction, links }),
  })
  return await res.json()
}

const deleteImage = async (
  id: ImageId,
): Promise<Api.Admin.DeleteImageResponseData> => {
  const res = await xhr.delete<Api.Admin.DeleteImageResponseData>(`/admin/api/images/${id}`)
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
