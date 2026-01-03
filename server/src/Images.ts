import probe from 'probe-image-size'
import fs from 'fs'

import config from './Config'
import type { Dim } from '@common/Geometry'
import Util, { logger } from '@common/Util'
import type { Tag, ImageInfo, UserId, ImageId, ImageRowWithCount, TagRow, ImageRow } from '@common/Types'
import type { ImagesRepo } from './repo/ImagesRepo'
import type { WhereRaw } from './lib/Db'
import type { ImageExif } from './ImageExif'
import FileSystem from './lib/FileSystem'

const log = logger('Images.ts')

export class Images {
  constructor(
    private readonly imagesRepo: ImagesRepo,
    private readonly imageExif: ImageExif,
  ) {}

  public async getAllTags(): Promise<Tag[]> {
    const tagRows = await this.imagesRepo.getAllTagsWithCount()
    return tagRows.map(row => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      total: row.images_count,
    }))
  }

  public async imageFromDb(imageId: ImageId): Promise<ImageInfo | null> {
    const imageInfos = await this.imagesByIdsFromDb([imageId])
    return imageInfos.length === 0 ? null : imageInfos[0]
  }

  public async imageByChecksumFromDb(checksum: string): Promise<ImageInfo | null> {
    const row = await this.imagesRepo.get({ checksum })
    return row ? this.imageFromDb(row.id) : null
  }

  private imageWithCountToImageInfo(
    row: ImageRowWithCount,
    tags: Record<number, TagRow[]>,
  ): ImageInfo {
    return {
      id: row.id as ImageId,
      uploaderUserId: row.uploader_user_id,
      uploaderName: row.uploader_user_name || null,
      filename: row.filename,
      url: `${config.dir.UPLOAD_URL}/${encodeURIComponent(row.filename)}`,
      title: row.title,
      tags: tags[row.id] ? tags[row.id].map(t => ({
        id: t.id,
        slug: t.slug,
        title: t.title,
        total: 0,
      })) : [],
      created: (new Date(row.created)).getTime(),
      width: row.width,
      height: row.height,
      private: !!row.private,
      gameCount: row.games_count,
      copyrightName: row.copyright_name,
      copyrightURL: row.copyright_url,
      reported: row.reported,
      nsfw: !!row.nsfw,
    }
  }

  public async imagesFromDb(
    search: string,
    orderBy: string,
    isPrivate: boolean,
    offset: number,
    limit: number,
    currentUserId: UserId | null,
    limitToUserId: UserId | null,
  ): Promise<ImageInfo[]> {
    const rows = await this.imagesRepo.searchImagesWithCount(search, orderBy, isPrivate, offset, limit, currentUserId, limitToUserId)
    const tags = await this.imagesRepo.getTagsByImageIds(rows.map(row => row.id))
    return rows.map(row => this.imageWithCountToImageInfo(row, tags))
  }

  public async imagesByIdsFromDb(
    ids: ImageId[],
  ): Promise<ImageInfo[]> {
    const rows = await this.imagesRepo.getImagesWithCountByIds(ids)
    const tags = await this.imagesRepo.getTagsByImageIds(rows.map(row => row.id))
    return rows.map(row => this.imageWithCountToImageInfo(row, tags))
  }

  public async getDimensions(imagePath: string): Promise<Dim> {
    const dimensions = await probe(fs.createReadStream(imagePath))
    const w = dimensions.width || 0
    const h = dimensions.height || 0

    const orientation = await this.imageExif.getOrientation(imagePath)
    // when image is rotated to the left or right, switch width/height
    // https://jdhao.github.io/2019/07/31/image_rotation_exif_info/
    if (orientation === 6 || orientation === 8) {
      return { w: h, h: w }
    }
    return { w, h }
  }

  public async setTags(imageId: ImageId, tags: string[]): Promise<void> {
    await this.imagesRepo.deleteTagRelations(imageId)
    for (const tag of tags) {
      const slug = Util.slug(tag)
      const id = await this.imagesRepo.upsertTag({ slug, title: tag })
      if (id) {
        await this.imagesRepo.insertTagRelation({
          image_id: imageId,
          category_id: id,
        })
      }
    }
  }

  public async insertImage(image: Omit<ImageRow, 'id'>): Promise<ImageId> {
    return await this.imagesRepo.insert(image)
  }

  public async updateImage(image: Partial<ImageRow>, where: WhereRaw): Promise<void> {
    await this.imagesRepo.update(image, where)
  }

  public async getImageById(imageId: ImageId): Promise<ImageRow | null> {
    return await this.imagesRepo.get({ id: imageId })
  }

  public getImagePath(filename: string): string {
    return `${config.dir.UPLOAD_DIR}/${filename}`
  }

  private async deleteAllFilesStartingWith(path: string): Promise<void> {
    // determine directory
    const parts = path.split('/')
    const dir = parts.slice(0, -1).join('/')
    const filenameStart = parts[parts.length - 1]

    try {
      const files = await FileSystem.readdir(dir)
      for (const file of files) {
        if (file.startsWith(filenameStart)) {
          try {
            await FileSystem.unlink(dir + '/' + file)
          } catch {
            log.error('unable to delete image', dir + '/' + file)
          }
        }
      }
    } catch {
      log.error('unable to delete images, unable to read dir', dir)
    }
  }

  public async deleteImagesFromStorage(filename: string): Promise<void> {
    // crops and resizes:
    const baseDirs = [config.dir.CROP_DIR, config.dir.RESIZE_DIR]
    for (const baseDir of baseDirs) {
      await this.deleteAllFilesStartingWith(`${baseDir}/${filename}-`)
    }

    // full image:
    const fullImage = this.getImagePath(filename)
    try {
      await FileSystem.unlink(fullImage)
    } catch {
      log.error('unable to delete image', fullImage)
    }
  }
}
