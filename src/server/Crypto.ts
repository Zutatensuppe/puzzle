import config from './Config'
import crypto from 'crypto'

const key = crypto.createHash('md5').update(config.secret).digest('hex')

export const encrypt = (str: string): string => {
  return Buffer.from(key + str, 'utf8').toString('base64')
}

export const decrypt = (str: string): string => {
  const decrypted = Buffer.from(str, 'base64').toString('utf8')
  return decrypted.substring(key.length)
}

export default {
  encrypt,
  decrypt,
}
