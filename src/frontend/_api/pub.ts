import { GameSettings } from "../../common/Types"
import Util from "../../common/Util"
import xhr from "./xhr"

const JSON_HEADERS = {
  'Accept': 'application/json',
  'Content-Type': 'application/json'
}

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

const logout = async() => {
  return await xhr.post('/api/logout', {
    headers: JSON_HEADERS,
    body: {},
  })
}

const config = async () => {
  return xhr.get(`/api/conf`, {})
}

const me = async () => {
  return xhr.get(`/api/me`, {})
}

const indexData = async () => {
  return xhr.get('/api/index-data', {})
}

const finishedGames = async (data: { limit: number, offset: number }) => {
  return xhr.get(`/api/finished-games${Util.asQueryArgs(data)}`, {})
}

const newgameData = async (data: { filters: { sort: string, tags: string[] } }) => {
  return xhr.get(`/api/newgame-data${Util.asQueryArgs(data.filters)}`, {})
}

const images = async (data: { filters: { sort: string, tags: string[], offset: number } }) => {
  return xhr.get(`/api/images${Util.asQueryArgs(data.filters)}`, {})
}

const replayData = async (data: { gameId: string, offset: number }) =>{
  return xhr.get(`/api/replay-data${Util.asQueryArgs(data)}`, {})
}

const saveImage = async (data: { id: any, title: any, tags: any }) => {
  return xhr.post('/api/save-image', {
    headers: JSON_HEADERS,
    body: JSON.stringify({
      id: data.id,
      title: data.title,
      tags: data.tags,
    }),
  })
}

const newGame = async (data: { gameSettings: GameSettings }) => {
  return xhr.post('/api/newgame', {
    headers: JSON_HEADERS,
    body: JSON.stringify(data.gameSettings),
  })
}

const upload = async (data: { file: File, title: string, tags: string[], isPrivate: boolean, onProgress: (progress: number) => void }) => {
  const formData = new FormData();
  formData.append('file', data.file, data.file.name);
  formData.append('title', data.title)
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
  indexData,
  newgameData,
  replayData,
  saveImage,
  newGame,
  upload,
  finishedGames,
  images,
}
