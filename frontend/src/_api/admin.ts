import { ClientId, GameId, ImageId, ServerInfo, UserId } from '../../../common/src/Types'
import xhr, { JSON_HEADERS } from './xhr'
import Util from '../../../common/src/Util'

const getGames = async (data: { limit: number, offset: number }) => {
  const res = await xhr.get(`/admin/api/games${Util.asQueryArgs(data)}`, {})
  return await res.json()
}

const deleteGame = async (id: GameId) => {
  const res = await xhr.delete(`/admin/api/games/${id}`, {})
  return await res.json()
}

const getUsers = async (data: { limit: number, offset: number }) => {
  const res = await xhr.get(`/admin/api/users${Util.asQueryArgs(data)}`, {})
  return await res.json()
}

const getServerInfo = async (): Promise<ServerInfo> => {
  const res = await xhr.get('/admin/api/server-info', {})
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

const getAnnouncements = async () => {
  const res = await xhr.get('/admin/api/announcements', {})
  return await res.json()
}

const postAnnouncement = async (title: string, message: string) => {
  const res = await xhr.post('/admin/api/announcements', {
    headers: JSON_HEADERS,
    body: JSON.stringify({ title, message }),
  })
  return await res.json()
}

const getImages = async (data: { limit: number, offset: number }) => {
  const res = await xhr.get(`/admin/api/images${Util.asQueryArgs(data)}`, {})
  return await res.json()
}

const deleteImage = async (id: ImageId) => {
  const res = await xhr.delete(`/admin/api/images/${id}`, {})
  return await res.json()
}

const getGroups = async () => {
  const res = await xhr.get('/admin/api/groups', {})
  return await res.json()
}

export default {
  getAnnouncements,
  postAnnouncement,
  getGames,
  deleteGame,
  getUsers,
  getImages,
  deleteImage,
  getGroups,
  getServerInfo,
  mergeClientIdsIntoUser,
  fixPieces,
}
