import { GameSettings } from "../../common/Types"
import Util from "../../common/Util"
import xhr from "./xhr"

const auth = async (login: string, pass: string) => {
  return await xhr.post('/api/auth', {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ login, pass }),
  })
}

const logout = async() => {
  return await xhr.post('/api/logout', {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
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

const replayData = async (data: { gameId: string, offset: number }) =>{
  return xhr.get(`/api/replay-data${Util.asQueryArgs(data)}`, {})
}

const saveImage = async (data: { id: any, title: any, tags: any }) => {
  return xhr.post('/api/save-image', {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      id: data.id,
      title: data.title,
      tags: data.tags,
    }),
  })
}

const newGame = async (data: { gameSettings: GameSettings }) => {
  return xhr.post('/api/newgame', {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
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
}
