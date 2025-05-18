import { ClientId, FeaturedRowWithCollections, GameId, ImageId, ServerInfo, UserId } from '../../../common/src/Types'
import xhr, { JSON_HEADERS } from './xhr'
import Util from '../../../common/src/Util'

const getGames = async (data: {
  limit: number
  offset: number
}) => {
  const res = await xhr.get(`/admin/api/games${Util.asQueryArgs(data)}`)
  return await res.json()
}

const deleteGame = async (
  id: GameId,
) => {
  const res = await xhr.delete(`/admin/api/games/${id}`)
  return await res.json()
}

const getUsers = async (data: {
  limit: number
  offset: number
}) => {
  const res = await xhr.get(`/admin/api/users${Util.asQueryArgs(data)}`)
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
) => {
  const res = await xhr.post('/admin/api/users/_merge_client_ids_into_user', {
    headers: JSON_HEADERS,
    body: JSON.stringify({ userId, clientIds, dry }),
  })
  return await res.json()
}

const fixPieces = async (
  gameId: GameId,
) => {
  const res = await xhr.post('/admin/api/games/_fix_pieces', {
    headers: JSON_HEADERS,
    body: JSON.stringify({ gameId }),
  })
  return await res.json()
}

const getAnnouncements = async (
  // no args
) => {
  const res = await xhr.get('/admin/api/announcements')
  return await res.json()
}

const postAnnouncement = async (
  title: string,
  message: string,
) => {
  const res = await xhr.post('/admin/api/announcements', {
    headers: JSON_HEADERS,
    body: JSON.stringify({ title, message }),
  })
  return await res.json()
}

const getImages = async (data: {
  limit: number
  offset: number
}) => {
  const res = await xhr.get(`/admin/api/images${Util.asQueryArgs(data)}`)
  return await res.json()
}

const getFeatureds = async (data: {
  limit: number
  offset: number
}) => {
  const res = await xhr.get(`/admin/api/featureds${Util.asQueryArgs(data)}`)
  return await res.json()
}

const getFeatured = async (
  id: number,
) => {
  const res = await xhr.get(`/admin/api/featureds/${id}`)
  return await res.json()
}

const saveFeatured = async (
  featured: FeaturedRowWithCollections,
) => {
  const res = await xhr.put(`/admin/api/featureds/${featured.id}`, {
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
) => {
  const res = await xhr.post('/admin/api/featureds', {
    headers: JSON_HEADERS,
    body: JSON.stringify({ type, name, introduction, links }),
  })
  return await res.json()
}

const deleteImage = async (
  id: ImageId,
) => {
  const res = await xhr.delete(`/admin/api/images/${id}`)
  return await res.json()
}

const getImage = async (
  id: ImageId,
) => {
  const res = await xhr.get(`/admin/api/images/${id}`)
  return await res.json()
}

const getGroups = async (
  // no args
) => {
  const res = await xhr.get('/admin/api/groups')
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
