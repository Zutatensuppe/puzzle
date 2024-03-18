import config from './Config'
import sharp from 'sharp'
import fs from 'fs'
import { logger } from '../../common/src/Util'
import Db from './Db'

const log = logger('ImageSnapshots.ts')

const tryRm = (f: string) => {
  try {
    fs.unlinkSync(f)
    console.log('removed image: ', f)
  } catch (e) {
    console.log('failed to remove image: ', e)
  }
}

export const storeImageSnapshot = async (imageBase64Str: string, gameId: string, ts: number, db: Db) => {
  const imgSnapshotDir = `${config.dir.UPLOAD_DIR}/image_snapshots`
  const filename = `${gameId}_${ts}.jpeg`
  if (fs.existsSync(`${imgSnapshotDir}/${filename}`)) {
    log.info(`image already exists`)
    return
  }

  if (!fs.existsSync(imgSnapshotDir)) {
    fs.mkdirSync(imgSnapshotDir, { recursive: true })
  }

  const imageData = imageBase64Str.split(';base64,').pop() as string
  try {
    const imgBuffer = Buffer.from(imageData, 'base64')
    await sharp(imgBuffer).jpeg({ quality: 75 }).toFile(`${imgSnapshotDir}/${filename}`)
  } catch (e) {
    log.error('failed to store image', e)
    return
  }

  const url = `/uploads/image_snapshots/${filename}`
  await db.update('games', { image_snapshot_url: url }, { id: gameId })
  console.log('stored image')


  // cleanup previous versions of the image...
  fs.readdirSync(imgSnapshotDir).forEach((file) => {
    if (!file.endsWith('.jpeg') || !file.startsWith(`${gameId}_`)) {
      return
    }
    const slashsplit = file.split('/')
    const file_split = (slashsplit.pop() as string).split('.')
    const basename = file_split[0]
    const basename_split = basename.split('_')
    const timestamp = parseInt(basename_split[1], 10)
    if (timestamp !== ts) {
      tryRm(`${imgSnapshotDir}/${file}`)
    }
  })

  // cleanup resized versions of the image...
  const resizeDir = `${config.dir.UPLOAD_DIR}/r`
  fs.readdirSync(resizeDir).forEach((file) => {
    if (
      file.startsWith(`image_snapshots_${gameId}_`) &&
      !file.startsWith(`image_snapshots_${gameId}_${ts}`) &&
      file.endsWith('.webp')
    ) {
      tryRm(`${resizeDir}/${file}`)
    }
  })
}
