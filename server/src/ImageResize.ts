import sharp from 'sharp'
import { logger } from '@common/Util'
import config from './Config'
import fs from './lib/FileSystem'
import type { Rect } from '@common/Geometry'
import type { ImageExif } from './ImageExif'

const log = logger('ImageResize.ts')

export class ImageResize {
  constructor(
    private readonly imageExif: ImageExif,
  ) {}

  public cropRestrictImage(
    sourceImagePath: string,
    filename: string,
    crop: Rect,
    maxw: number,
    maxh: number,
    format: string,
  ): Promise<string | null> {
    return this.executeAndStore({
      fn: (img: sharp.Sharp) => img
        .extract(this.sharpRegionFromRect(crop))
        .resize(maxw, maxh, { fit: 'inside', withoutEnlargement: true }),
      sourceImagePath: sourceImagePath,
      baseDir: config.dir.CROP_DIR,
      filename: `${filename}-${crop.x}_${crop.y}_${crop.w}_${crop.h}_max_${maxw}x${maxh}-q75.${format}`,
      format,
      label: 'crop resizing image',
    })
  }

  public restrictImage(
    sourceImagePath: string,
    filename: string,
    maxw: number,
    maxh: number,
    format: string,
  ): Promise<string | null> {
    return this.executeAndStore({
      fn: (img: sharp.Sharp) => img
        .resize(maxw, maxh, { fit: 'inside', withoutEnlargement: true }),
      sourceImagePath,
      baseDir: config.dir.RESIZE_DIR,
      filename: `${filename}-max_${maxw}x${maxh}-q75.${format}`,
      format,
      label: 'resizing image',
    })
  }

  public cropImage(
    sourceImagePath: string,
    filename: string,
    crop: Rect,
    format: string,
  ): Promise<string | null> {
    return this.executeAndStore({
      fn: (img: sharp.Sharp) => img
        .extract(this.sharpRegionFromRect(crop)),
      sourceImagePath,
      baseDir: config.dir.CROP_DIR,
      filename: `${filename}-${crop.x}_${crop.y}_${crop.w}_${crop.h}-q75.${format}`,
      format,
      label: 'cropping image',
    })
  }

  public resizeImage(
    sourceImagePath: string,
    filename: string,
    w: number | null,
    h: number | null,
    fit: 'contain' | 'cover',
    format: string,
  ): Promise<string | null> {
    return this.executeAndStore({
      fn: (img: sharp.Sharp) => img
        .resize(w, h || null, { fit }),
      sourceImagePath,
      baseDir: config.dir.RESIZE_DIR,
      filename: `${filename}-${w}x${h || 0}-${fit}-q75.${format}`,
      format,
      label: 'resizing image',
    })
  }

  private async executeAndStore(args: {
    fn: (sharpImg: sharp.Sharp) => sharp.Sharp | Promise<sharp.Sharp>,
    sourceImagePath: string,
    baseDir: string,
    filename: string,
    format: string,
    label: string,
  }) {
    const targetFilename = `${args.baseDir}/${args.filename}`
    if (!await fs.exists(targetFilename)) {
      try {
        await this.createDirIfNotExists(args.baseDir)
        const sharpImg = await this.loadSharpImage(args.sourceImagePath)
        const resized = await args.fn(sharpImg)
        await this.storeWithFormat(resized, targetFilename, args.format)
      } catch (e) {
        log.error('error when ' + args.label, args.filename, e)
        return null
      }
    }
    return targetFilename
  }

  private sharpRegionFromRect (rect: Rect): sharp.Region {
    return { top: rect.y, left: rect.x, width: rect.w, height: rect.h }
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

  private async loadSharpImage(imagePath: string): Promise<sharp.Sharp> {
    const orientation = await this.imageExif.getOrientation(imagePath)
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
