import jimp from 'jimp'
import { logger } from '../../common/src/Util'
import config from './Config'
import { Images } from './Images'
import fs from 'fs'
import { Rect } from '../../common/src/Geometry'

const log = logger('ImageResize.ts')

type JimpImage = any

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

  async loadJimpImage(imagePath: string): Promise<JimpImage> {
    const orientation = await this.images.getExifOrientation(imagePath)
    const jimpImg: JimpImage = await jimp.read(imagePath)
    const rot = this.orientationToRotationDegree(orientation)

    return rot === 0 ? jimpImg : new Promise((resolve) => {
      jimpImg.rotate(rot, () => {
        resolve(jimpImg)
      })
    })
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
        const jimpImg = await this.loadJimpImage(originalImagePath)
        return new Promise((resolve) => {
          jimpImg.crop(crop.x, crop.y, crop.w, crop.h).scaleToFit(maxw, maxh).quality(75).write(cropFilename, () => {
            resolve(cropFilename)
          })
        })
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
      const resizeFilename = `${baseDir}/${filename}-max_${maxw}x${maxh}-q75.jpeg`
      if (!fs.existsSync(resizeFilename)) {
        if (!fs.existsSync(baseDir)) {
          fs.mkdirSync(baseDir, { recursive: true })
        }
        const originalImagePath = `${config.dir.UPLOAD_DIR}/${filename}`
        const jimpImg = await this.loadJimpImage(originalImagePath)
        return new Promise((resolve) => {
          jimpImg.scaleToFit(maxw, maxh).quality(75).write(resizeFilename, () => {
            resolve(resizeFilename)
          })
        })
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
      const cropFilename = `${baseDir}/${filename}-${crop.x}_${crop.y}_${crop.w}_${crop.h}-q75.jpeg`
      if (!fs.existsSync(cropFilename)) {
        if (!fs.existsSync(baseDir)) {
          fs.mkdirSync(baseDir, { recursive: true })
        }
        const originalImagePath = `${config.dir.UPLOAD_DIR}/${filename}`
        const jimpImg = await this.loadJimpImage(originalImagePath)
        return new Promise((resolve) => {
          jimpImg.crop(crop.x, crop.y, crop.w, crop.h).quality(75).write(cropFilename, () => {
            resolve(cropFilename)
          })
        })
      }
      return cropFilename
    } catch (e) {
      log.error('error when cropping image', filename, e)
      return null
    }
  }

  async resizeImage(
    filename: string,
    w: number,
    h: number | null,
    fit: 'contain' | 'cover',
  ): Promise<string | null> {
    try {
      const baseDir = config.dir.RESIZE_DIR
      const resizeFilename = `${baseDir}/${filename}-${w}x${h || 0}-${fit}-q75.jpeg`
      if (!fs.existsSync(resizeFilename)) {
        if (!fs.existsSync(baseDir)) {
          fs.mkdirSync(baseDir, { recursive: true })
        }
        const originalImagePath = `${config.dir.UPLOAD_DIR}/${filename}`
        const jimpImg = await this.loadJimpImage(originalImagePath)
        log.info(w, h, resizeFilename)
        return new Promise((resolve) => {
          if (!h) {
            h = w * jimpImg.bitmap.height / jimpImg.bitmap.width
          }
          if (fit === 'contain') {
            jimpImg.contain(w, h).quality(75).write(resizeFilename, () => {
              resolve(resizeFilename)
            })
          } else {
            jimpImg.cover(w, h).quality(75).write(resizeFilename, () => {
              resolve(resizeFilename)
            })
          }
        })
      }
      return resizeFilename
    } catch (e) {
      log.error('error when resizing image', filename, e)
      return null
    }
  }
}
