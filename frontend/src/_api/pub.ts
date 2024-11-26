import { GameId, GameSettings, ImageId, ImagesRequestData, NewGameDataRequestData } from '../../../common/src/Types'
import Util from '../../../common/src/Util'
import xhr, { JSON_HEADERS, XhrRequest } from './xhr'

const auth = async (email: string, password: string) => {
  return await xhr.post('/api/auth/local', {
    headers: JSON_HEADERS,
    body: JSON.stringify({ email, password }),
  })
}

const register = async (username: string, email: string, password: string) => {
  return await xhr.post('/api/register', {
    headers: JSON_HEADERS,
    body: JSON.stringify({ username, email, password }),
  })
}

const sendPasswordResetEmail = async (email: string) => {
  return await xhr.post('/api/send-password-reset-email', {
    headers: JSON_HEADERS,
    body: JSON.stringify({ email }),
  })
}

const changePassword = async (password: string, token: string) => {
  return await xhr.post('/api/change-password', {
    headers: JSON_HEADERS,
    body: JSON.stringify({ password, token }),
  })
}

const logout = async () => {
  return await xhr.post('/api/logout', {
    headers: JSON_HEADERS,
    body: {},
  })
}

const getAnnouncements = async () => {
  const res = await xhr.get('/api/announcements', {})
  return await res.json()
}

const config = () => {
  return xhr.get(`/api/conf`, {})
}

const me = () => {
  return xhr.get(`/api/me`, {})
}

const indexData = () => {
  return xhr.get('/api/index-data', {})
}

const deleteGame = async (id: GameId) => {
  return await xhr.delete(`/api/games/${id}`, {})
}

const finishedGames = (data: { limit: number, offset: number }) => {
  return xhr.get(`/api/finished-games${Util.asQueryArgs(data)}`, {})
}

const newgameData = (data: NewGameDataRequestData): XhrRequest => {
  return xhr.getRequest(`/api/newgame-data${Util.asQueryArgs(data)}`, {})
}

const images = (data: ImagesRequestData): XhrRequest => {
  return xhr.getRequest(`/api/images${Util.asQueryArgs(data)}`, {})
}

const replayGameData = (data: { gameId: GameId }) => {
  return xhr.get(`/api/replay-game-data${Util.asQueryArgs(data)}`, {})
}

const replayLogData =  (data: { gameId: GameId, logFileIdx: number }) => {
  return xhr.get(`/api/replay-log-data${Util.asQueryArgs(data)}`, {})
}

const saveImage = (data: { id: ImageId, title: any, copyrightName: string, copyrightURL: string, tags: any }) => {
  return xhr.post('/api/save-image', {
    headers: JSON_HEADERS,
    body: JSON.stringify({
      id: data.id,
      title: data.title,
      copyrightName: data.copyrightName,
      copyrightURL: data.copyrightURL,
      tags: data.tags,
    }),
  })
}

const newGame = (data: { gameSettings: GameSettings }) => {
  return xhr.post('/api/newgame', {
    headers: JSON_HEADERS,
    body: JSON.stringify(data.gameSettings),
  })
}

const getFeaturedData = (data: { type: 'category' | 'artist', slug: string }) => {
  return xhr.get(`/api/featured/${data.type}/${data.slug}`, {})
}

const getFeaturedTeaserData = () => {
  return xhr.get(`/api/featured-teasers`, {})
}

const upload = (data: { file: File, title: string, copyrightName: string, copyrightURL: string, tags: string[], isPrivate: boolean, onProgress: (progress: number) => void }) => {
  const formData = new FormData()
  formData.append('file', data.file, data.file.name)
  formData.append('title', data.title)
  formData.append('copyrightName', data.copyrightName)
  formData.append('copyrightURL', data.copyrightURL)
  // @ts-ignore
  formData.append('tags', data.tags)
  // @ts-ignore
  formData.append('private', data.isPrivate)
  return xhr.post('/api/upload', {
    body: formData,
    onUploadProgress: (evt: ProgressEvent<XMLHttpRequestEventTarget>): void => {
      data.onProgress(evt.loaded / evt.total)
    },
  })
}

export default {
  auth,
  register,
  sendPasswordResetEmail,
  changePassword,
  logout,
  config,
  me,
  deleteGame,
  getAnnouncements,
  getFeaturedData,
  getFeaturedTeaserData,
  indexData,
  newgameData,
  replayGameData,
  replayLogData,
  saveImage,
  newGame,
  upload,
  finishedGames,
  images,
}
