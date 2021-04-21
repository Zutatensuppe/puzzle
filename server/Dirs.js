import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const BASE_DIR = `${__dirname}/..`

export const DATA_DIR = `${BASE_DIR}/data`
export const UPLOAD_DIR = `${BASE_DIR}/data/uploads`
export const UPLOAD_URL = `/uploads`
export const COMMON_DIR = `${BASE_DIR}/common/`
export const GAME_DIR = `${BASE_DIR}/game/`
export const TEMPLATE_DIR = `${BASE_DIR}/game/templates`
