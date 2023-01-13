import crypto from 'crypto'
import config from './Config'

export const COOKIE_TOKEN = 'x-token'

export const passwordHash = (
  plainPass: string,
  salt: string,
): string => {
  const hash = crypto.createHmac('sha512', config.secret)
  hash.update(`${salt}${plainPass}`)
  return hash.digest('hex')
}

// do something CRYPTO secure???
export const generateSalt = (): string => {
  return randomString(10)
}

// do something CRYPTO secure???
export const generatePass = (): string => {
  return randomString(10)
}

// do something CRYPTO secure???
export const generateToken = (): string => {
  return randomString(32)
}

const randomString = (length: number): string => {
  const a = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'.split('')
  const b = []
  for (let i = 0; i < length; i++) {
    const j = parseInt((Math.random() * (a.length - 1)).toFixed(0), 10)
    b[i] = a[j]
  }
  return b.join('')
}
