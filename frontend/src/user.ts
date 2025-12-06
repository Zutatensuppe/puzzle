import type { Handler } from 'mitt'
import mitt from 'mitt'
import _api from './_api'
import storage from './storage'
import xhr from './_api/xhr'
import { PLAYER_SETTINGS } from '../../common/src/Types'
import type { ClientId, User } from '../../common/src/Types'
import { computed, ref } from 'vue'

const showNsfw = ref(storage.getBool('showNsfw', false))
const toggleNsfw = (): void => {
  showNsfw.value = !showNsfw.value
  storage.setBool('showNsfw', showNsfw.value)
}

export const useNsfw = () => {
  return {
    showNsfw,
    toggleNsfw,
  }
}

export const me = ref<null | User>(null)
export const loggedIn = computed<boolean>(() => !!(me.value && me.value.type === 'user'))
export const isAdmin = computed<boolean>(() => !!(me.value?.groups.includes('admin')))

export const eventBus = mitt()

export const onLoginStateChange = (callback: Handler<unknown>) => {
  const offs: (() => void)[] = []
  offs.push(onEvent('login', callback))
  offs.push(onEvent('logout', callback))

  return () => {
    for (const off of offs) {
      off()
    }
  }
}

const onEvent = (evt: string, callback: Handler<unknown>) => {
  eventBus.on(evt, callback)
  return () => {
    eventBus.off(evt, callback)
  }
}

export async function init(): Promise<void> {
  xhr.setClientId(storage.uniq('ID') as ClientId)
  const res = await _api.pub.me()
  try {
    const data = await res.json()
    if ('reason' in data) {
      console.log('not logged in')
      me.value = null
      eventBus.emit('logout')
    } else {
      console.log('logged in (reg or guest)')
      xhr.setClientId(data.clientId)
      me.value = data
      eventBus.emit('login')
    }
  } catch {
    console.log('not logged in')
    eventBus.emit('logout')
  }
}

export async function logout(): Promise<{ error: string | false }> {
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
  const res = await _api.pub.logout()
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

export async function login(
  email: string,
  password: string,
): Promise<{ error: string | false }> {
  const res = await _api.pub.auth(email, password)
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
  const res = await _api.pub.register(username, email, password)
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
  const res = await _api.pub.sendPasswordResetEmail(email)
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
  const res = await _api.pub.changePassword(password, token)
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


export const api = {
  logout,
  login,
  register,
  sendPasswordResetEmail,
  changePassword,
}
