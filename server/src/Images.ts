import probe from 'probe-image-size'
import fs from 'fs'
import exif from 'exif'

import config from './Config'
import { Dim } from '../../common/src/Geometry'
import Util, { logger } from '../../common/src/Util'
import { Tag, ImageInfo } from '../../common/src/Types'
import { ImageRow, ImageRowWithCount, ImagesRepo } from './repo/ImagesRepo'
import { WhereRaw } from './Db'

const log = logger('Images.ts')

export class Images {
  constructor(
    private readonly imagesRepo: ImagesRepo,
  ) {
    // pass
  }

  async getExifOrientation(imagePath: string): Promise<number> {
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

  async getAllTags(): Promise<Tag[]> {
    const tagRows = await this.imagesRepo.getAllTagsWithCount()
    return tagRows.map(row => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      total: row.images_count,
    }))
  }

  async getTags(imageId: number): Promise<Tag[]> {
    const tagRows = await this.imagesRepo.getTagsByImageId(imageId)
    return  tagRows.map(row => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      total: 0,
    }))
  }

  async imageFromDb(imageId: number): Promise<ImageInfo | null> {
    const imageInfos = await this.imagesByIdsFromDb([imageId])
    return imageInfos.length === 0 ? null : imageInfos[0]
  }

  async imageWithCountToImageInfo(row: ImageRowWithCount): Promise<ImageInfo> {
    return {
      id: row.id as number,
      uploaderUserId: row.uploader_user_id,
      uploaderName: row.uploader_user_name || null,
      filename: row.filename,
      url: `${config.dir.UPLOAD_URL}/${encodeURIComponent(row.filename)}`,
      title: row.title,
      tags: await this.getTags(row.id),
      created: row.created.getTime(),
      width: row.width,
      height: row.height,
      private: !!row.private,
      gameCount: row.games_count,
      copyrightName: row.copyright_name,
      copyrightURL: row.copyright_url,
    }
  }

  async imagesFromDb(
    search: string,
    orderBy: string,
    isPrivate: boolean,
    offset: number,
    limit: number,
    userId: number,
  ): Promise<ImageInfo[]> {
    const rows = await this.imagesRepo.searchImagesWithCount(search, orderBy, isPrivate, offset, limit, userId)
    const images = []
    for (const row of rows) {
      images.push(await this.imageWithCountToImageInfo(row))
    }
    return images
  }

  async imagesByIdsFromDb(
    ids: number[],
  ): Promise<ImageInfo[]> {
    const rows = await this.imagesRepo.getImagesWithCountByIds(ids)
    const images = []
    for (const row of rows) {
      images.push(await this.imageWithCountToImageInfo(row))
    }
    return images
  }

  async getDimensions(imagePath: string): Promise<Dim> {
    const dimensions = await probe(fs.createReadStream(imagePath))
    const orientation = await this.getExifOrientation(imagePath)
    // when image is rotated to the left or right, switch width/height
    // https://jdhao.github.io/2019/07/31/image_rotation_exif_info/
    if (orientation === 6 || orientation === 8) {
      return {
        w: dimensions.height || 0,
        h: dimensions.width || 0,
      }
    }
    return {
      w: dimensions.width || 0,
      h: dimensions.height || 0,
    }
  }

  async setTags(imageId: number, tags: string[]): Promise<void> {
    this.imagesRepo.deleteTagRelations(imageId)
    for (const tag of tags) {
      const slug = Util.slug(tag)
      const id = await this.imagesRepo.upsertTag({ slug, title: tag })
      if (id) {
        this.imagesRepo.insertTagRelation({
          image_id: imageId,
          category_id: id,
        })
      }
    }
  }

  async insertImage(image: Partial<ImageRow>): Promise<number> {
    return await this.imagesRepo.insert(image)
  }

  async updateImage(image: Partial<ImageRow>, where: WhereRaw): Promise<void> {
    await this.imagesRepo.update(image, where)
  }

  async getImageById(imageId: number): Promise<ImageRow | null> {
    return await this.imagesRepo.get({ id: imageId })
  }
}
