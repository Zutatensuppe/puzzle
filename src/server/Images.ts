import sizeOf from 'image-size'
import exif from 'exif'
import sharp from 'sharp'

import config from './Config'
import Db, { OrderBy, WhereRaw } from './Db'
import { Dim } from '../common/Geometry'
import Util, { logger } from '../common/Util'
import { Tag, ImageInfo } from '../common/Types'

const log = logger('Images.ts')

const resizeImage = async (filename: string): Promise<void> => {
  if (!filename.toLowerCase().match(/\.(jpe?g|webp|png)$/)) {
    return
  }

  const imagePath = `${config.dir.UPLOAD_DIR}/${filename}`
  const imageOutPath = `${config.dir.UPLOAD_DIR}/r/${filename}`
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

const getAllTags = async (db: Db): Promise<Tag[]> => {
  const query = `
select c.id, c.slug, c.title, count(*) as total from categories c
inner join image_x_category ixc on c.id = ixc.category_id
inner join images i on i.id = ixc.image_id
group by c.id order by total desc;`
  return (await db._getMany(query)).map(row => ({
    id: parseInt(row.id, 10) || 0,
    slug: row.slug,
    title: row.title,
    total: parseInt(row.total, 10) || 0,
  }))
}

const getTags = async (db: Db, imageId: number): Promise<Tag[]> => {
  const query = `
select * from categories c
inner join image_x_category ixc on c.id = ixc.category_id
where ixc.image_id = $1`
  return (await db._getMany(query, [imageId])).map(row => ({
    id: parseInt(row.id, 10) || 0,
    slug: row.slug,
    title: row.title,
    total: 0,
  }))
}

const imageFromDb = async (db: Db, imageId: number): Promise<ImageInfo> => {
  const i = await db.get('images', { id: imageId })
  return {
    id: i.id,
    uploaderUserId: i.uploader_user_id,
    filename: i.filename,
    url: `${config.dir.UPLOAD_URL}/${encodeURIComponent(i.filename)}`,
    title: i.title,
    tags: await getTags(db, i.id),
    created: i.created * 1000,
    width: i.width,
    height: i.height,
  }
}

const allImagesFromDb = async (
  db: Db,
  tagSlugs: string[],
  orderBy: string,
  isPrivate: boolean,
): Promise<ImageInfo[]> => {
  const orderByMap = {
    alpha_asc: [{filename: 1}],
    alpha_desc: [{filename: -1}],
    date_asc: [{created: 1}],
    date_desc: [{created: -1}],
  } as Record<string, OrderBy>

  // TODO: .... clean up
  const wheresRaw: WhereRaw = {}
  wheresRaw['private'] = isPrivate ? 1 : 0
  if (tagSlugs.length > 0) {
    const c = await db.getMany('categories', {slug: {'$in': tagSlugs}})
    if (!c) {
      return []
    }
    const where = db._buildWhere({
      'category_id': {'$in': c.map(x => x.id)}
    })
    const ids = (await db._getMany(`
select i.id from image_x_category ixc
inner join images i on i.id = ixc.image_id ${where.sql};
`, where.values)).map(img => img.id)
    if (ids.length === 0) {
      return []
    }
    wheresRaw['id'] = {'$in': ids}
  }
  const tmpImages = await db.getMany('images', wheresRaw, orderByMap[orderBy])
  const images = []
  for (const i of tmpImages) {
    images.push({
      id: i.id as number,
      uploaderUserId: i.uploader_user_id,
      filename: i.filename,
      url: `${config.dir.UPLOAD_URL}/${encodeURIComponent(i.filename)}`,
      title: i.title,
      tags: await getTags(db, i.id),
      created: i.created * 1000,
      width: i.width,
      height: i.height,
      private: !!i.private,
    })
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

const setTags = async (db: Db, imageId: number, tags: string[]): Promise<void> => {
  await db.delete('image_x_category', { image_id: imageId })
  for (const tag of tags) {
    const slug = Util.slug(tag)
    const id = await db.upsert('categories', { slug, title: tag }, { slug }, 'id')
    if (id) {
      await db.insert('image_x_category', {
        image_id: imageId,
        category_id: id,
      })
    }
  }
}

export default {
  imageFromDb,
  allImagesFromDb,
  getAllTags,
  resizeImage,
  getDimensions,
  setTags,
}
