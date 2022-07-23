import xhr from "../xhr"

export const getGames = async () => {
  const res = await xhr.get('/admin/api/games', {})
  return await res.json()
}

export const deleteGame = async (id: number) => {
  const res = await xhr.delete(`/admin/api/games/${id}`, {})
  return await res.json()
}

export const getUsers = async () => {
  const res = await xhr.get('/admin/api/users', {})
  return await res.json()
}

export const getImages = async () => {
  const res = await xhr.get('/admin/api/images', {})
  return await res.json()
}

export const getGroups = async () => {
  const res = await xhr.get('/admin/api/groups', {})
  return await res.json()
}
