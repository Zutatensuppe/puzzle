import {
  AnnouncementsResponseData,
  ApiDataFinishedGames,
  ApiDataIndexData,
  AuthLocalResponseData,
  ChangePasswordResponseData,
  ConfigResponseData,
  DeleteGameResponseData,
  FeaturedResponseData,
  FeaturedTeasersResponseData,
  GameId,
  GameSettings,
  ImageId,
  ImageInfo,
  ImagesRequestData,
  ImagesResponseData,
  LogoutResponseData,
  MeResponseData,
  NewGameDataRequestData,
  NewGameDataResponseData,
  NewGameResponseData,
  RegisterResponseData,
  ReplayGameDataResponseData,
  ReportResponseData,
  SaveImageResponseData,
  SendPasswordResetEmailResponseData,
} from '../../../common/src/Types'
import Util from '../../../common/src/Util'
import xhr, { JSON_HEADERS, Response, XhrRequest } from './xhr'

const auth = (
  email: string,
  password: string,
): Promise<Response<AuthLocalResponseData>> => {
  return xhr.post('/api/auth/local', {
    headers: JSON_HEADERS,
    body: JSON.stringify({ email, password }),
  })
}

const register = (
  username: string,
  email: string,
  password: string,
): Promise<Response<RegisterResponseData>> => {
  return xhr.post('/api/register', {
    headers: JSON_HEADERS,
    body: JSON.stringify({ username, email, password }),
  })
}

const sendPasswordResetEmail = (
  email: string,
): Promise<Response<SendPasswordResetEmailResponseData>> => {
  return xhr.post('/api/send-password-reset-email', {
    headers: JSON_HEADERS,
    body: JSON.stringify({ email }),
  })
}

const changePassword = (
  password: string,
  token: string,
): Promise<Response<ChangePasswordResponseData>> => {
  return xhr.post('/api/change-password', {
    headers: JSON_HEADERS,
    body: JSON.stringify({ password, token }),
  })
}

const logout = (
  // no args
): Promise<Response<LogoutResponseData>> => {
  return xhr.post('/api/logout', {
    headers: JSON_HEADERS,
    body: {},
  })
}

const getAnnouncements = async (
  // no args
): Promise<AnnouncementsResponseData> => {
  const res = await xhr.get<AnnouncementsResponseData>('/api/announcements', {})
  return await res.json()
}

const config = (
  // no args
): Promise<Response<ConfigResponseData>> => {
  return xhr.get(`/api/conf`, {})
}

const me = (
  // no args
): Promise<Response<MeResponseData>> => {
  return xhr.get(`/api/me`, {})
}

const indexData = (
  // no args
): Promise<Response<ApiDataIndexData>> => {
  return xhr.get('/api/index-data', {})
}

const deleteGame = (
  id: GameId,
): Promise<Response<DeleteGameResponseData>> => {
  return xhr.delete(`/api/games/${id}`, {})
}

const finishedGames = (data: {
  limit: number
  offset: number
}): Promise<Response<ApiDataFinishedGames>> => {
  return xhr.get(`/api/finished-games${Util.asQueryArgs(data)}`, {})
}

const newgameData = (
  data: NewGameDataRequestData,
): XhrRequest<NewGameDataResponseData> => {
  return xhr.getRequest(`/api/newgame-data${Util.asQueryArgs(data)}`, {})
}

const images = (
  data: ImagesRequestData,
): XhrRequest<ImagesResponseData> => {
  return xhr.getRequest(`/api/images${Util.asQueryArgs(data)}`, {})
}

const replayGameData = (data: {
  gameId: GameId
}): Promise<Response<ReplayGameDataResponseData>> => {
  return xhr.get(`/api/replay-game-data${Util.asQueryArgs(data)}`, {})
}

const replayLogData =  (data: {
  gameId: GameId
  logFileIdx: number
}): Promise<Response<unknown>> => {
  return xhr.get(`/api/replay-log-data${Util.asQueryArgs(data)}`, {})
}

const saveImage = (data: {
  id: ImageId
  title: any
  copyrightName: string
  copyrightURL: string
  tags: any
}): Promise<Response<SaveImageResponseData>> => {
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

const newGame = (data: {
  gameSettings: GameSettings
}): Promise<Response<NewGameResponseData>> => {
  return xhr.post('/api/newgame', {
    headers: JSON_HEADERS,
    body: JSON.stringify(data.gameSettings),
  })
}

const getFeaturedData = (data: {
  type: 'category' | 'artist'
  slug: string
}): Promise<Response<FeaturedResponseData>> => {
  return xhr.get(`/api/featured/${data.type}/${data.slug}`, {})
}

const getFeaturedTeaserData = (
  // no args
): Promise<Response<FeaturedTeasersResponseData>> => {
  return xhr.get(`/api/featured-teasers`, {})
}

const reportImage = (data: {
  id: ImageId
  reason: string,
}): Promise<Response<ReportResponseData>> => {
  return xhr.post('/api/moderation/report-image', {
    headers: JSON_HEADERS,
    body: JSON.stringify(data),
  })
}

const reportGame = (data: {
  id: GameId
  reason: string,
}): Promise<Response<ReportResponseData>> => {
  return xhr.post('/api/moderation/report-game', {
    headers: JSON_HEADERS,
    body: JSON.stringify(data),
  })
}

const upload = (
  data: {
    file: File
    title: string
    copyrightName: string
    copyrightURL: string
    tags: string[]
    isPrivate: boolean
    isNsfw: boolean
    onProgress: (progress: number) => void
  },
): Promise<Response<ImageInfo>> => {
  const formData = new FormData()
  formData.append('file', data.file, data.file.name)
  formData.append('title', data.title)
  formData.append('copyrightName', data.copyrightName)
  formData.append('copyrightURL', data.copyrightURL)
  // @ts-ignore
  formData.append('tags', data.tags)
  formData.append('private', String(data.isPrivate))
  formData.append('nsfw', String(data.isNsfw))
  return xhr.post('/api/upload', {
    body: formData,
    onUploadProgress: (evt: ProgressEvent<XMLHttpRequestEventTarget>): void => {
      data.onProgress(evt.loaded / evt.total)
    },
  })
}

export default {
  auth,
  changePassword,
  config,
  deleteGame,
  finishedGames,
  getAnnouncements,
  getFeaturedData,
  getFeaturedTeaserData,
  images,
  indexData,
  logout,
  me,
  newGame,
  newgameData,
  register,
  replayGameData,
  replayLogData,
  reportGame,
  reportImage,
  saveImage,
  sendPasswordResetEmail,
  upload,
}
