import mitt from 'mitt';
import api from "./_api";

export interface User {
  id: number
  created: string
  clientId: string
  type: 'guest' | 'user'
}

let me: null | User = null;
export const eventBus = mitt()

async function init(): Promise<void> {
  const res = await api.pub.me()
  me = res.status === 200 ? (await res.json()) : null
  if (me) {
    console.log('loggedin')
    eventBus.emit('login')
  } else {
    console.log('loggedout')
    eventBus.emit('logout')
  }
}

async function logout(): Promise<{ error: string | false }> {
  const res = await api.pub.logout();
  const data = await res.json();
  if (data.success) {
    me = null
    console.log('loggedout')
    eventBus.emit('logout')
    return { error: false }
  } else {
    return { error: "[2021-09-25 18:36]" }
  }
}

async function login(user: string, pass: string): Promise<{ error: string | false }> {
  const res = await api.pub.auth(user, pass);
  if (res.status === 200) {
    await init()
    return { error: false }
  } else if (res.status === 401) {
    return { error: (await res.json()).reason }
  } else {
    return { error: "Unknown error" }
  }
}

export default {
  getMe: () => me,
  eventBus,
  logout,
  login,
  init,
}
