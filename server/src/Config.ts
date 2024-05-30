import { realpathSync, existsSync, readFileSync } from 'fs'
import { logger } from '../../common/src/Util'
import { CannyConfig, DiscordConfig, MailConfig, TwitchConfig } from '../../common/src/Types'
import dotenv from 'dotenv'

dotenv.config()

const log = logger('Config.ts')

const BASE_DIR = realpathSync(process.env.BASE_DIR || __dirname + '/../../')
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
    publicBaseUrl: string,
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
    twitch: TwitchConfig
  }
  canny: CannyConfig
  mail: MailConfig
  discord: DiscordConfig
}

const init = (): Config => {
  const configFiles = process.env.APP_CONFIG
    ? [process.env.APP_CONFIG]
    : ['config.json', `${BASE_DIR}/config.json`]
  for (const configFile of configFiles) {
    if (!existsSync(configFile)) {
      continue
    }
    log.info('using config file:', configFile)
    const config: Config = JSON.parse(String(readFileSync(configFile)))
    config.dir = { DATA_DIR, UPLOAD_DIR, UPLOAD_URL, CROP_DIR, RESIZE_DIR, PUBLIC_DIR, DB_PATCHES_DIR }
    return config
  }

  log.error('no config file found. use APP_CONFIG environment variable to specify config file path')
  process.exit(2)
}
const config: Config = init()

export default config
