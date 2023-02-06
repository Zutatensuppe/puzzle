import sharp from 'sharp'
import { logger } from '../common/Util'
import config from './Config'
import { getExifOrientation } from './Images'
import fs from 'fs'

const log = logger('ImageResize.ts')

const resizeImage = async (filename: string): Promise<void> => {
  try {
    const imagePath = `${config.dir.UPLOAD_DIR}/${filename}`
    const resizeDir = `${config.dir.UPLOAD_DIR}/r/`
    if (!fs.existsSync(resizeDir)) {
      fs.mkdirSync(resizeDir, { recursive: true })
    }
    const imageOutPath = `${resizeDir}/${filename}`
    const orientation = await getExifOrientation(imagePath)

    let sharpImg = sharp(imagePath, { failOnError: false })
    // when image is rotated to the left or right, switch width/height
    // https://jdhao.github.io/2019/07/31/image_rotation_exif_info/
    if (orientation === 6) {
      sharpImg = sharpImg.rotate(90)
    } else if (orientation === 3) {
      sharpImg = sharpImg.rotate(180)
    } else if (orientation === 8) {
      sharpImg = sharpImg.rotate(270)
    }
    const sizes: [number, number | null, 'contain' | 'cover' | 'inside' | 'outside'][] = [
      [150, 100, 'contain'],
      [375, 210, 'contain'],
      [375, null, 'cover'],
      [620, 496, 'contain'],
    ]
    for (const [w, h, fit] of sizes) {
      const filename = `${imageOutPath}-${w}x${h || 0}.webp`
      if (!fs.existsSync(filename)) {
        log.info(w, h, filename)
        await sharpImg.resize(w, h, { fit }).toFile(filename)
      }
    }
  } catch (e) {
    log.error('error when resizing image', filename, e)
  }
}

export default {
  resizeImage,
}
