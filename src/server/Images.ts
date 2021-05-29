import sizeOf from 'image-size'
import fs from 'fs'
import exif from 'exif'
import sharp from 'sharp'

import {UPLOAD_DIR, UPLOAD_URL} from './Dirs'
import Db, { OrderBy, WhereRaw } from './Db'
import { Dim } from '../common/Geometry'
import { logger } from '../common/Util'
import { Timestamp } from '../common/Types'

const log = logger('Images.ts')

interface Tag
{
  id: number
  slug: string
  title: string
}

interface ImageInfo
{
  id: number
  filename: string
  file: string
  url: string
  title: string
  tags: Tag[]
  created: Timestamp,
}

const resizeImage = async (filename: string): Promise<void> => {
  if (!filename.toLowerCase().match(/\.(jpe?g|webp|png)$/)) {
    return
  }

  const imagePath = `${UPLOAD_DIR}/${filename}`
  const imageOutPath = `${UPLOAD_DIR}/r/${filename}`
  const orientation = await getExifOrientation(imagePath)

  let sharpImg = sharp(imagePath, { failOnError: false })
  // when image is rotated to the left or right, switch width/height
  // https://jdhao.github.io/2019/07/31/image_rotation_exif_info/
  if (orientation === 6) {
    sharpImg = sharpImg.rotate()
  } else if (orientation === 3) {
    sharpImg = sharpImg.rotate().rotate()
  } else if (orientation === 8) {
    sharpImg = sharpImg.rotate().rotate().rotate()
  }
  const sizes = [
    [150, 100],
    [375, 210],
  ]
  for (const [w,h] of sizes) {
    log.info(w, h, imagePath)
    await sharpImg
      .resize(w, h, { fit: 'contain' })
      .toFile(`${imageOutPath}-${w}x${h}.webp`)
  }
}

async function getExifOrientation(imagePath: string): Promise<number> {
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

const getTags = (db: Db, imageId: number): Tag[] => {
  const query = `
select * from categories c
inner join image_x_category ixc on c.id = ixc.category_id
where ixc.image_id = ?`
  return db._getMany(query, [imageId]).map(row => ({
    id: parseInt(row.number, 10) || 0,
    slug: row.slug,
    title: row.tittle,
  }))
}

const imageFromDb = (db: Db, imageId: number): ImageInfo => {
  const i = db.get('images', { id: imageId })
  return {
    id: i.id,
    filename: i.filename,
    file: `${UPLOAD_DIR}/${i.filename}`,
    url: `${UPLOAD_URL}/${encodeURIComponent(i.filename)}`,
    title: i.title,
    tags: getTags(db, i.id),
    created: i.created * 1000,
  }
}

const allImagesFromDb = (
  db: Db,
  tagSlugs: string[],
  orderBy: string
): ImageInfo[] => {
  const orderByMap = {
    alpha_asc: [{filename: 1}],
    alpha_desc: [{filename: -1}],
    date_asc: [{created: 1}],
    date_desc: [{created: -1}],
  } as Record<string, OrderBy>

  // TODO: .... clean up
  const wheresRaw: WhereRaw = {}
  if (tagSlugs.length > 0) {
    const c = db.getMany('categories', {slug: {'$in': tagSlugs}})
    if (!c) {
      return []
    }
    const where = db._buildWhere({
      'category_id': {'$in': c.map(x => x.id)}
    })
    const ids = db._getMany(`
select i.id from image_x_category ixc
inner join images i on i.id = ixc.image_id ${where.sql};
`, where.values).map(img => img.id)
    if (ids.length === 0) {
      return []
    }
    wheresRaw['id'] = {'$in': ids}
  }
  const images = db.getMany('images', wheresRaw, orderByMap[orderBy])

  return images.map(i => ({
    id: i.id as number,
    filename: i.filename,
    file: `${UPLOAD_DIR}/${i.filename}`,
    url: `${UPLOAD_URL}/${encodeURIComponent(i.filename)}`,
    title: i.title,
    tags: getTags(db, i.id),
    created: i.created * 1000,
  }))
}

const allImagesFromDisk = (
  tags: string[],
  sort: string
): ImageInfo[] => {
  let images = fs.readdirSync(UPLOAD_DIR)
    .filter(f => f.toLowerCase().match(/\.(jpe?g|webp|png)$/))
    .map(f => ({
      id: 0,
      filename: f,
      file: `${UPLOAD_DIR}/${f}`,
      url: `${UPLOAD_URL}/${encodeURIComponent(f)}`,
      title: f.replace(/\.[a-z]+$/, ''),
      tags: [] as Tag[],
      created: fs.statSync(`${UPLOAD_DIR}/${f}`).mtime.getTime(),
    }))

  switch (sort) {
    case 'alpha_asc':
      images = images.sort((a, b) => {
        return a.file > b.file ? 1 : -1
      })
      break;

    case 'alpha_desc':
      images = images.sort((a, b) => {
        return a.file < b.file ? 1 : -1
      })
      break;

    case 'date_asc':
      images = images.sort((a, b) => {
        return a.created > b.created ? 1 : -1
      })
      break;

    case 'date_desc':
    default:
      images = images.sort((a, b) => {
        return a.created < b.created ? 1 : -1
      })
      break;
  }
  return images
}

async function getDimensions(imagePath: string): Promise<Dim> {
  const dimensions = sizeOf(imagePath)
  const orientation = await getExifOrientation(imagePath)
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

export default {
  allImagesFromDisk,
  imageFromDb,
  allImagesFromDb,
  resizeImage,
  getDimensions,
}
