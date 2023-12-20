import sharp from 'sharp'
import { logger } from '../../common/src/Util'
import config from './Config'
import { Images } from './Images'
import fs from 'fs'
import { Rect } from '../../common/src/Geometry'

const log = logger('ImageResize.ts')

export class ImageResize {
  constructor(
    private readonly images: Images,
  ) {
    // pass
  }

  orientationToRotationDegree(orientation: number): number {
    // when image is rotated to the left or right, switch width/height
    // https://jdhao.github.io/2019/07/31/image_rotation_exif_info/
    switch (orientation) {
      case 6: return 90
      case 3: return 180
      case 8: return 270
      default: return 0
    }
  }

  async loadSharpImage(imagePath: string): Promise<sharp.Sharp> {
    const orientation = await this.images.getExifOrientation(imagePath)
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

  async cropRestrictImage(filename: string, crop: Rect, maxw: number, maxh: number): Promise<string | null> {
    try {
      const baseDir = config.dir.CROP_DIR
      const cropFilename = `${baseDir}/${filename}-${crop.x}_${crop.y}_${crop.w}_${crop.h}_max_${maxw}x${maxh}-q75.jpeg`
      if (!fs.existsSync(cropFilename)) {
        if (!fs.existsSync(baseDir)) {
          fs.mkdirSync(baseDir, { recursive: true })
        }
        const originalImagePath = `${config.dir.UPLOAD_DIR}/${filename}`
        const sharpImg = await this.loadSharpImage(originalImagePath)
        await sharpImg.extract({
          top: crop.y,
          left: crop.x,
          width: crop.w,
          height: crop.h,
        }).resize(maxw, maxh, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 75 }).toFile(cropFilename)
      }
      return cropFilename
    } catch (e) {
      log.error('error when crop resizing image', filename, e)
      return null
    }
  }

  async restrictImage(filename: string, maxw: number, maxh: number): Promise<string | null> {
    try {
      const baseDir = config.dir.RESIZE_DIR
      const resizeFilename = `${baseDir}/${filename}-max_${maxw}x${maxh}-q75.webp`
      if (!fs.existsSync(resizeFilename)) {
        if (!fs.existsSync(baseDir)) {
          fs.mkdirSync(baseDir, { recursive: true })
        }
        const originalImagePath = `${config.dir.UPLOAD_DIR}/${filename}`
        const sharpImg = await this.loadSharpImage(originalImagePath)
        await sharpImg.resize(maxw, maxh, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 75 }).toFile(resizeFilename)
      }
      return resizeFilename
    } catch (e) {
      log.error('error when resizing image', filename, e)
      return null
    }
  }

  async cropImage(filename: string, crop: Rect): Promise<string | null> {
    try {
      const baseDir = config.dir.CROP_DIR
      const cropFilename = `${baseDir}/${filename}-${crop.x}_${crop.y}_${crop.w}_${crop.h}-q75.webp`
      if (!fs.existsSync(cropFilename)) {
        if (!fs.existsSync(baseDir)) {
          fs.mkdirSync(baseDir, { recursive: true })
        }
        const originalImagePath = `${config.dir.UPLOAD_DIR}/${filename}`
        const sharpImg = await this.loadSharpImage(originalImagePath)
        await sharpImg.extract({
          top: crop.y,
          left: crop.x,
          width: crop.w,
          height: crop.h,
        }).webp({ quality: 75 }).toFile(cropFilename)
      }
      return cropFilename
    } catch (e) {
      log.error('error when cropping image', filename, e)
      return null
    }
  }

  async resizeImage(
    filename: string,
    w: number | null,
    h: number | null,
    fit: 'contain' | 'cover',
  ): Promise<string | null> {
    try {
      const baseDir = config.dir.RESIZE_DIR
      const resizeFilename = `${baseDir}/${filename}-${w}x${h || 0}-${fit}-q75.webp`
      if (!fs.existsSync(resizeFilename)) {
        if (!fs.existsSync(baseDir)) {
          fs.mkdirSync(baseDir, { recursive: true })
        }
        const originalImagePath = `${config.dir.UPLOAD_DIR}/${filename}`
        const sharpImg = await this.loadSharpImage(originalImagePath)
        log.info(w, h, resizeFilename)
        await sharpImg.resize(w, h || null, { fit }).webp({ quality: 75 }).toFile(resizeFilename)
      }
      return resizeFilename
    } catch (e) {
      log.error('error when resizing image', filename, e)
      return null
    }
  }
}
