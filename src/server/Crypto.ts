import config from './Config'
import crypto from 'crypto'

const algorithm = 'aes256'
const inputEncoding = 'utf8';
const outputEncoding = 'hex';
const ivlength = 16  // AES blocksize
const key = crypto.createHash('md5').update(config.secret).digest("hex")
const iv = crypto.randomBytes(ivlength)

export const encrypt = (str: string): string => {
  const cipher = crypto.createCipheriv(algorithm, key, iv)
  let ciphered = cipher.update(str, inputEncoding, outputEncoding)
  ciphered += cipher.final(outputEncoding)
  return iv.toString(outputEncoding) + ':' + ciphered
}

export const decrypt = (str: string): string => {
  const components = str.split(':')
  const firstPart = components.shift() as string
  const iv_from_ciphertext = Buffer.from(firstPart, outputEncoding)
  const decipher = crypto.createDecipheriv(algorithm, key, iv_from_ciphertext)
  let deciphered = decipher.update(components.join(':'), outputEncoding, inputEncoding)
  deciphered += decipher.final(inputEncoding)
  return deciphered
}

export default {
  encrypt,
  decrypt,
}
