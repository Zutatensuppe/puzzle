import sharp from 'sharp'
import exif from 'exif'
import { logger } from '../../common/src/Util'
import config from './Config'
import fs from './FileSystem'
import { Rect } from '../../common/src/Geometry'

const log = logger('ImageResize.ts')

export class ImageResize {
  public async cropRestrictImage(
    sourceImagePath: string,
    filename: string,
    crop: Rect,
    maxw: number,
    maxh: number,
    format: string,
  ): Promise<string | null> {
    try {
      const baseDir = config.dir.CROP_DIR
      const targetFilename = `${baseDir}/${filename}-${crop.x}_${crop.y}_${crop.w}_${crop.h}_max_${maxw}x${maxh}-q75.${format}`
      if (!await fs.exists(targetFilename)) {
        await this.createDirIfNotExists(baseDir)
        const sharpImg = await this.loadSharpImage(sourceImagePath)
        const resized = sharpImg.extract({
          top: crop.y,
          left: crop.x,
          width: crop.w,
          height: crop.h,
        }).resize(maxw, maxh, { fit: 'inside', withoutEnlargement: true })
        await this.storeWithFormat(resized, targetFilename, format)
      }
      return targetFilename
    } catch (e) {
      log.error('error when crop resizing image', filename, e)
      return null
    }
  }

  public async restrictImage(
    sourceImagePath: string,
    filename: string,
    maxw: number,
    maxh: number,
    format: string,
  ): Promise<string | null> {
    const baseDir = config.dir.RESIZE_DIR
    const targetFilename = `${baseDir}/${filename}-max_${maxw}x${maxh}-q75.${format}`
    if (!await fs.exists(targetFilename)) {
      await this.createDirIfNotExists(baseDir)
      try {
        const sharpImg = await this.loadSharpImage(sourceImagePath)
        const resized = sharpImg.resize(maxw, maxh, { fit: 'inside', withoutEnlargement: true })
        await this.storeWithFormat(resized, targetFilename, format)
      } catch (e) {
        log.error('error when resizing image', filename, e)
        return null
      }
    }
    return targetFilename
  }

  public async cropImage(
    sourceImagePath: string,
    filename: string,
    crop: Rect,
    format: string,
  ): Promise<string | null> {
    const baseDir = config.dir.CROP_DIR
    const targetFilename = `${baseDir}/${filename}-${crop.x}_${crop.y}_${crop.w}_${crop.h}-q75.${format}`
    if (!await fs.exists(targetFilename)) {
      await this.createDirIfNotExists(baseDir)
      try {
        const sharpImg = await this.loadSharpImage(sourceImagePath)
        const resized = sharpImg.extract({
          top: crop.y,
          left: crop.x,
          width: crop.w,
          height: crop.h,
        })
        await this.storeWithFormat(resized, targetFilename, format)
      } catch (e) {
        log.error('error when cropping image', filename, e)
        return null
      }
    }
    return targetFilename
  }

  public async resizeImage(
    sourceImagePath: string,
    filename: string,
    w: number | null,
    h: number | null,
    fit: 'contain' | 'cover',
    format: string,
  ): Promise<string | null> {
    const baseDir = config.dir.RESIZE_DIR
    const targetFilename = `${baseDir}/${filename}-${w}x${h || 0}-${fit}-q75.${format}`
    if (!await fs.exists(targetFilename)) {
      await this.createDirIfNotExists(baseDir)
      try {
        const sharpImg = await this.loadSharpImage(sourceImagePath)
        log.info(w, h, targetFilename)
        const resized = sharpImg.resize(w, h || null, { fit })
        await this.storeWithFormat(resized, targetFilename, format)
      } catch (e) {
        log.error('error when resizing image', filename, e)
        return null
      }
    }
    return targetFilename
  }

  private orientationToRotationDegree(orientation: number): number {
    // when image is rotated to the left or right, switch width/height
    // https://jdhao.github.io/2019/07/31/image_rotation_exif_info/
    switch (orientation) {
      case 6: return 90
      case 3: return 180
      case 8: return 270
      default: return 0
    }
  }

  private async getExifOrientation(imagePath: string): Promise<number> {
    return new Promise((resolve) => {
      new exif.ExifImage({ image: imagePath }, (error, exifData) => {
        if (error) {
          resolve(0)
        } else {
          resolve(exifData.image.Orientation || 0)
        }
      })
    })
  }

  private async loadSharpImage(imagePath: string): Promise<sharp.Sharp> {
    const orientation = await this.getExifOrientation(imagePath)
    const sharpImg = sharp(imagePath, { failOnError: false })
    const deg = this.orientationToRotationDegree(orientation)
    return deg ? sharpImg.rotate(deg) : sharpImg
  }

  private async createDirIfNotExists(dir: string): Promise<void> {
    if (!await fs.exists(dir)) {
      await fs.mkdir(dir)
    }
  }

  private async storeWithFormat(
    resized: sharp.Sharp,
    filename: string,
    format: string,
  ): Promise<void> {
    switch (format) {
      case 'png': await resized.png({ quality: 75 }).toFile(filename); break
      case 'jpeg': await resized.jpeg({ quality: 75 }).toFile(filename); break
      case 'webp':
      default:
        await resized.webp({ quality: 75 }).toFile(filename); break
    }
  }
}
