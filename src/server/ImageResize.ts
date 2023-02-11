import sharp from 'sharp'
import { logger } from '../common/Util'
import config from './Config'
import { getExifOrientation } from './Images'
import fs from 'fs'
import { Rect } from '../common/Geometry'

const log = logger('ImageResize.ts')

const loadSharpImage = async (imagePath: string): Promise<sharp.Sharp> => {
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
  return sharpImg
}

const cropImage = async (filename: string, crop: Rect): Promise<string | null> => {
  try {
    const baseDir = config.dir.CROP_DIR
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true })
    }
    const originalImagePath = `${config.dir.UPLOAD_DIR}/${filename}`
    const sharpImg = await loadSharpImage(originalImagePath)
    const cropFilename = `${baseDir}/${filename}-${crop.x}_${crop.y}_${crop.w}_${crop.h}.webp`
    if (!fs.existsSync(cropFilename)) {
      await sharpImg.extract({
        top: crop.y,
        left: crop.x,
        width: crop.w,
        height: crop.h
      }).toFile(cropFilename)
    }
    return cropFilename
  } catch (e) {
    log.error('error when cropping image', filename, e)
    return null
  }
}

const resizeImage = async (
  filename: string,
  w: number | null,
  h: number | null,
  fit: keyof sharp.FitEnum,
): Promise<string | null> => {
  try {
    const baseDir = config.dir.RESIZE_DIR
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true })
    }
    const originalImagePath = `${config.dir.UPLOAD_DIR}/${filename}`
    const sharpImg = await loadSharpImage(originalImagePath)
    const resizeFilename = `${baseDir}/${filename}-${w}x${h || 0}.webp`
    if (!fs.existsSync(resizeFilename)) {
      log.info(w, h, resizeFilename)
      await sharpImg.resize(w, h, { fit }).toFile(resizeFilename)
    }
    return resizeFilename
  } catch (e) {
    log.error('error when resizing image', filename, e)
    return null
  }
}

const createImageVariants = async (filename: string): Promise<void> => {
  try {
    const sizes: [number, number | null, 'contain' | 'cover' | 'inside' | 'outside'][] = [
      [150, 100, 'contain'],
      [375, 210, 'contain'],
      [375, null, 'cover'],
      [620, 496, 'contain'],
    ]
    for (const [w, h, fit] of sizes) {
      await resizeImage(filename, w, h, fit)
    }
  } catch (e) {
    log.error('error when resizing image', filename, e)
  }
}

export default {
  createImageVariants,
  cropImage,
}
