import xhr, { JSON_HEADERS } from './xhr'

const getGames = async () => {
  const res = await xhr.get('/admin/api/games', {})
  return await res.json()
}

const deleteGame = async (id: number) => {
  const res = await xhr.delete(`/admin/api/games/${id}`, {})
  return await res.json()
}

const getUsers = async () => {
  const res = await xhr.get('/admin/api/users', {})
  return await res.json()
}

const getServerInfo = async () => {
  const res = await xhr.get('/admin/api/server-info', {})
  return await res.json()
}

const mergeClientIdsIntoUser = async (
  userId: number,
  clientIds: string[],
  dry: boolean,
) => {
  const res = await xhr.post('/admin/api/users/_merge_client_ids_into_user', {
    headers: JSON_HEADERS,
    body: JSON.stringify({ userId, clientIds, dry }),
  })
  return await res.json()
}

const fixPieces = async (
  gameId: string,
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

const getImages = async () => {
  const res = await xhr.get('/admin/api/images', {})
  return await res.json()
}

const deleteImage = async (id: number) => {
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
