import config from './Config'
import sharp from 'sharp'
import fs from './FileSystem'
import path from 'path'
import { logger } from '@common/Util'
import type Db from './Db'
import type { GameId } from '@common/Types'

const log = logger('ImageSnapshots.ts')

const tryRm = async (f: string): Promise<void> => {
  try {
    await fs.unlink(f)
    log.info('removed image: ', f)
  } catch (e) {
    log.error('failed to remove image: ', e)
  }
}

const cleanupPreviousVersionsOfImage = async (imgSnapshotDir: string, gameId: GameId, ts: number): Promise<void> => {
  try {
    const files = await fs.readdir(imgSnapshotDir)
    const removalPromises = files.map(async (file) => {
      if (!file.endsWith('.jpeg') || !file.startsWith(`${gameId}_`)) {
        return
      }

      const slashSplit = file.split('/')
      const fileSplit = (slashSplit.pop() as string).split('.')
      const basename = fileSplit[0]
      const basenameSplit = basename.split('_')
      const timestamp = parseInt(basenameSplit[1], 10)

      if (timestamp !== ts) {
        await tryRm(path.join(imgSnapshotDir, file))
      }
    })

    await Promise.all(removalPromises)
  } catch (err) {
    console.error('Error processing snapshots:', err)
  }
}

const cleanupResizedVersionsOfImage = async (resizeDir: string, gameId: GameId, ts: number): Promise<void> => {
  try {
    const files = await fs.readdir(resizeDir)
    const removalPromises = files.map(async (file) => {
      if (
        file.startsWith(`image_snapshots_${gameId}_`) &&
        !file.startsWith(`image_snapshots_${gameId}_${ts}`) &&
        file.endsWith('.webp')
      ) {
        await tryRm(`${resizeDir}/${file}`)
      }
    })
    await Promise.all(removalPromises)
  } catch (err) {
    console.error('Error processing resized snapshots:', err)
  }
}

export const storeImageSnapshot = async (imageBase64Str: string, gameId: GameId, ts: number, db: Db) => {
  const imgSnapshotDir = `${config.dir.UPLOAD_DIR}/image_snapshots`
  const filename = `${gameId}_${ts}.jpeg`
  if (await fs.exists(`${imgSnapshotDir}/${filename}`)) {
    log.info(`image already exists`)
    return
  }

  if (!await fs.exists(imgSnapshotDir)) {
    await fs.mkdir(imgSnapshotDir)
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
  log.info('stored image')

  // cleanup previous versions of the image...
  await cleanupPreviousVersionsOfImage(imgSnapshotDir, gameId, ts)

  // cleanup resized versions of the image...
  const resizeDir = `${config.dir.UPLOAD_DIR}/r`
  await cleanupResizedVersionsOfImage(resizeDir, gameId, ts)
}
