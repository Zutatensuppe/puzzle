import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const BASE_DIR = `${__dirname}/../..`

export const DATA_DIR = `${BASE_DIR}/data`
export const UPLOAD_DIR = `${BASE_DIR}/data/uploads`
export const UPLOAD_URL = `/uploads`
export const PUBLIC_DIR = `${BASE_DIR}/build/public/`

export const DB_PATCHES_DIR = `${BASE_DIR}/src/dbpatches`
export const DB_FILE = `${BASE_DIR}/data/db.sqlite`
