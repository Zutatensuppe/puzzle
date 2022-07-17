import xhr from "./xhr"

export const auth = async (login: string, pass: string) => {
  return await xhr.post('/api/auth', {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ login, pass }),
  })
}

export const logout = async() => {
  return await xhr.post('/api/logout', {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: {},
  })
}

export default {
  auth,
  logout,
}
