import type { GameId, ImageInfo, Api } from '../../../common/src/Types'
import Util from '../../../common/src/Util'
import xhr, { JSON_HEADERS } from './xhr'
import type { Response, XhrRequest } from './xhr'

const auth = (
  email: string,
  password: string,
): Promise<Response<Api.AuthLocalResponseData>> => {
  return xhr.post('/api/auth/local', {
    headers: JSON_HEADERS,
    body: JSON.stringify({ email, password }),
  })
}

const register = (
  username: string,
  email: string,
  password: string,
): Promise<Response<Api.RegisterResponseData>> => {
  return xhr.post('/api/register', {
    headers: JSON_HEADERS,
    body: JSON.stringify({ username, email, password }),
  })
}

const sendPasswordResetEmail = (
  email: string,
): Promise<Response<Api.SendPasswordResetEmailResponseData>> => {
  return xhr.post('/api/send-password-reset-email', {
    headers: JSON_HEADERS,
    body: JSON.stringify({ email }),
  })
}

const changePassword = (
  password: string,
  token: string,
): Promise<Response<Api.ChangePasswordResponseData>> => {
  return xhr.post('/api/change-password', {
    headers: JSON_HEADERS,
    body: JSON.stringify({ password, token }),
  })
}

const logout = (
  // no args
): Promise<Response<Api.LogoutResponseData>> => {
  return xhr.post('/api/logout', {
    headers: JSON_HEADERS,
  })
}

const getAnnouncements = async (
  // no args
): Promise<Api.AnnouncementsResponseData> => {
  const res = await xhr.get<Api.AnnouncementsResponseData>('/api/announcements')
  return await res.json()
}

const config = (
  // no args
): Promise<Response<Api.ConfigResponseData>> => {
  return xhr.get(`/api/conf`)
}

const me = (
  // no args
): Promise<Response<Api.MeResponseData>> => {
  return xhr.get(`/api/me`)
}

const indexData = (
  // no args
): Promise<Response<Api.ApiDataIndexData>> => {
  return xhr.get('/api/index-data')
}

const deleteGame = (
  id: GameId,
): Promise<Response<Api.DeleteGameResponseData>> => {
  return xhr.delete(`/api/games/${id}`)
}

const finishedGames = (
  data: Api.FinishedGamesRequestData,
): Promise<Response<Api.FinishedGamesResponseData>> => {
  return xhr.get(`/api/finished-games${Util.asQueryArgs(data)}`)
}

const newgameData = (
  data: Api.NewGameDataRequestData,
): XhrRequest<Api.NewGameDataResponseData> => {
  return xhr.getRequest(`/api/newgame-data${Util.asQueryArgs(data)}`)
}

const images = (
  data: Api.ImagesRequestData,
): XhrRequest<Api.ImagesResponseData> => {
  return xhr.getRequest(`/api/images${Util.asQueryArgs(data)}`)
}

const replayGameData = (
  data: Api.ReplayGameDataRequestData,
): Promise<Response<Api.ReplayGameDataResponseData>> => {
  return xhr.get(`/api/replay-game-data${Util.asQueryArgs(data)}`)
}

const replayLogData =  (
  data: Api.ReplayLogDataRequestData,
): Promise<Response<unknown>> => {
  return xhr.get(`/api/replay-log-data${Util.asQueryArgs(data)}`)
}

const saveImage = (
  data: Api.SaveImageRequestData,
): Promise<Response<Api.SaveImageResponseData>> => {
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

const newGame = (
  data: Api.NewGameRequestData,
): Promise<Response<Api.NewGameResponseData>> => {
  return xhr.post('/api/newgame', {
    headers: JSON_HEADERS,
    body: JSON.stringify(data.gameSettings),
  })
}

const getFeaturedData = (
  data: Api.FeaturedRequestData,
): Promise<Response<Api.FeaturedResponseData>> => {
  return xhr.get(`/api/featured/${data.type}/${data.slug}`)
}

const getFeaturedTeaserData = (
  // no args
): Promise<Response<Api.FeaturedTeasersResponseData>> => {
  return xhr.get(`/api/featured-teasers`)
}

const reportImage = (
  data: Api.ReportImageRequestData,
): Promise<Response<Api.ReportResponseData>> => {
  return xhr.post('/api/moderation/report-image', {
    headers: JSON_HEADERS,
    body: JSON.stringify(data),
  })
}

const reportGame = (
  data: Api.ReportGameRequestData,
): Promise<Response<Api.ReportResponseData>> => {
  return xhr.post('/api/moderation/report-game', {
    headers: JSON_HEADERS,
    body: JSON.stringify(data),
  })
}

const upload = (
  data: Api.UploadRequestDataWithProgress,
): Promise<Response<ImageInfo>> => {
  const formData = new FormData()
  formData.append('file', data.file)
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
