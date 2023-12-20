import { readFileSync } from 'fs'
import { logger } from '../../common/src/Util'
import { CannyConfig, DiscordConfig, MailConfig } from '../../common/src/Types'
import dotenv from 'dotenv'

dotenv.config()

const log = logger('Config.ts')

const BASE_DIR = process.env.BASE_DIR
const DATA_DIR = `${BASE_DIR}/data`
const UPLOAD_DIR = `${DATA_DIR}/uploads`
const CROP_DIR = `${UPLOAD_DIR}/c`
const RESIZE_DIR = `${UPLOAD_DIR}/r`
const UPLOAD_URL = `/uploads`
const PUBLIC_DIR = process.env.PUBLIC_DIR || `${BASE_DIR}/build/public`
const DB_PATCHES_DIR = process.env.DB_PATCHES_DIR || `${BASE_DIR}/db/dbpatches`

export interface Config {
  db: {
    connectStr: string
  }
  http: {
    public_hostname: string,
    hostname: string
    port: number
  }
  ws: {
    hostname: string
    port: number
    connectstring: string
  }
  persistence: {
    interval: number
  }
  dir: {
    DB_PATCHES_DIR: string
    DATA_DIR: string
    UPLOAD_DIR: string
    CROP_DIR: string
    RESIZE_DIR: string
    UPLOAD_URL: string
    PUBLIC_DIR: string
  }
  secret: string
  auth: {
    twitch: {
      client_id: string
      client_secret: string
    }
  }
  canny: CannyConfig
  mail: MailConfig
  discord: DiscordConfig
}

const init = (): Config => {
  const configFile = process.env.APP_CONFIG || 'config.json'
  if (configFile === '') {
    log.error('APP_CONFIG environment variable not set or empty')
    process.exit(2)
  }
  const config: Config = JSON.parse(String(readFileSync(configFile)))
  config.dir = { DATA_DIR, UPLOAD_DIR, UPLOAD_URL, CROP_DIR, RESIZE_DIR, PUBLIC_DIR, DB_PATCHES_DIR }
  return config
}
const config: Config = init()

export default config
