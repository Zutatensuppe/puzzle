import mitt from 'mitt'
import api from './_api'
import storage from './storage'
import xhr from './_api/xhr'
import { ClientId, PLAYER_SETTINGS, User } from '../../common/src/Types'
import { ref } from 'vue'

const showNsfw = ref(storage.getBool('showNsfw', false))
const toggleNsfw = (): void => {
  showNsfw.value = !showNsfw.value
  storage.setBool('showNsfw', showNsfw.value)
}

// Temporarily make individual nsfw items visible.
// This is deliberately not persisted.
const nsfwItemsVisible = ref<string[]>([])
const toggleNsfwItem = (id: string): void => {
  if (nsfwItemsVisible.value.includes(id)) {
    nsfwItemsVisible.value = nsfwItemsVisible.value.filter((i) => i !== id)
  } else {
    nsfwItemsVisible.value.push(id)
  }
}

export const useNsfw = () => {
  return {
    showNsfw,
    toggleNsfw,
    toggleNsfwItem,
    nsfwItemsVisible,
  }
}

let me: null | User = null
export const eventBus = mitt()

async function init(): Promise<void> {
  xhr.setClientId(storage.uniq('ID') as ClientId)
  const res = await api.pub.me()
  try {
    const data = await res.json()
    if ('reason' in data) {
      console.log('not logged in')
      eventBus.emit('logout')
    } else {
      me = data
      console.log('logged in (reg or guest)')
      xhr.setClientId(me.clientId)
      eventBus.emit('login')
    }
  } catch {
    console.log('not logged in')
    eventBus.emit('logout')
  }
}

async function logout(): Promise<{ error: string | false }> {
  // remove all relevant data on logout
  storage.remove('ID')
  storage.remove('lastSeenAnnouncement')
  storage.remove(PLAYER_SETTINGS.SOUND_VOLUME)
  storage.remove(PLAYER_SETTINGS.SOUND_ENABLED)
  storage.remove(PLAYER_SETTINGS.OTHER_PLAYER_CLICK_SOUND_ENABLED)
  storage.remove(PLAYER_SETTINGS.COLOR_BACKGROUND)
  storage.remove(PLAYER_SETTINGS.SHOW_TABLE)
  storage.remove(PLAYER_SETTINGS.TABLE_TEXTURE)
  storage.remove(PLAYER_SETTINGS.USE_CUSTOM_TABLE_TEXTURE)
  storage.remove(PLAYER_SETTINGS.CUSTOM_TABLE_TEXTURE)
  storage.remove(PLAYER_SETTINGS.CUSTOM_TABLE_TEXTURE_SCALE)
  storage.remove(PLAYER_SETTINGS.PLAYER_COLOR)
  storage.remove(PLAYER_SETTINGS.PLAYER_NAME)
  storage.remove(PLAYER_SETTINGS.SHOW_PLAYER_NAMES)
  const res = await api.pub.logout()
  try {
    const data = await res.json()
    if ('success' in data) {
      await init()
      return { error: false }
    }

    return { error: '[2021-09-25 18:36]' }
  } catch {
    return { error: 'Unknown error' }
  }
}

async function login(
  email: string,
  password: string,
): Promise<{ error: string | false }> {
  const res = await api.pub.auth(email, password)
  try {
    const data = await res.json()
    if ('success' in data) {
      await init()
      return { error: false }
    }
    return { error: data.reason }
  } catch {
    return { error: 'Unknown error' }
  }
}

async function register(
  username: string,
  email: string,
  password: string,
): Promise<{ error: string | false }> {
  const res = await api.pub.register(username, email, password)
  try {
    const data = await res.json()
    if ('success' in data) {
      return { error: false }
    }
    return { error: data.reason }
  } catch {
    return { error: 'Unknown error' }
  }
}

async function sendPasswordResetEmail(
  email: string,
): Promise<{ error: string | false }> {
  const res = await api.pub.sendPasswordResetEmail(email)
  try {
    const data = await res.json()
    if ('success' in data) {
      return { error: false }
    }
    return { error: data.reason }
  } catch {
    return { error: 'Unknown error' }
  }
}

async function changePassword(
  password: string,
  token: string,
): Promise<{ error: string | false }> {
  const res = await api.pub.changePassword(password, token)
  try {
    const data = await res.json()
    if ('success' in data) {
      return { error: false }
    }
    return { error: data.reason }
  } catch {
    return { error: 'Unknown error' }
  }
}

export default {
  getMe: () => me,
  eventBus,
  logout,
  login,
  register,
  sendPasswordResetEmail,
  changePassword,
  init,
}
