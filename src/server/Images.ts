import sizeOf from 'image-size'
import fs from 'fs'
import exif from 'exif'
import sharp from 'sharp'

import {UPLOAD_DIR, UPLOAD_URL} from './Dirs'
import Db from './Db'

const resizeImage = async (filename: string) => {
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
  for (let [w,h] of sizes) {
    console.log(w, h, imagePath)
    await sharpImg.resize(w, h, { fit: 'contain' }).toFile(`${imageOutPath}-${w}x${h}.webp`)
  }
}

async function getExifOrientation(imagePath: string) {
  return new Promise((resolve, reject) => {
    new exif.ExifImage({ image: imagePath }, function (error, exifData) {
      if (error) {
        resolve(0)
      } else {
        resolve(exifData.image.Orientation)
      }
    })
  })
}

const getTags = (db: Db, imageId: number) => {
  const query = `
select * from categories c
inner join image_x_category ixc on c.id = ixc.category_id
where ixc.image_id = ?`
  return db._getMany(query, [imageId])
}

const imageFromDb = (db: Db, imageId: number) => {
  const i = db.get('images', { id: imageId })
  return {
    id: i.id,
    filename: i.filename,
    file: `${UPLOAD_DIR}/${i.filename}`,
    url: `${UPLOAD_URL}/${encodeURIComponent(i.filename)}`,
    title: i.title,
    tags: getTags(db, i.id) as any[],
    created: i.created * 1000,
  }
}

const allImagesFromDb = (db: Db, tagSlugs: string[], sort: string) => {
  const sortMap = {
    alpha_asc: [{filename: 1}],
    alpha_desc: [{filename: -1}],
    date_asc: [{created: 1}],
    date_desc: [{created: -1}],
  } as Record<string, any>

  // TODO: .... clean up
  const wheresRaw: Record<string, any> = {}
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
  const images = db.getMany('images', wheresRaw, sortMap[sort])

  return images.map(i => ({
    id: i.id as number,
    filename: i.filename,
    file: `${UPLOAD_DIR}/${i.filename}`,
    url: `${UPLOAD_URL}/${encodeURIComponent(i.filename)}`,
    title: i.title,
    tags: getTags(db, i.id) as any[],
    created: i.created * 1000,
  }))
}

const allImagesFromDisk = (tags: string[], sort: string) => {
  let images = fs.readdirSync(UPLOAD_DIR)
    .filter(f => f.toLowerCase().match(/\.(jpe?g|webp|png)$/))
    .map(f => ({
      id: 0,
      filename: f,
      file: `${UPLOAD_DIR}/${f}`,
      url: `${UPLOAD_URL}/${encodeURIComponent(f)}`,
      title: f.replace(/\.[a-z]+$/, ''),
      tags: [] as any[],
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

async function getDimensions(imagePath: string) {
  let dimensions = sizeOf(imagePath)
  const orientation = await getExifOrientation(imagePath)
  // when image is rotated to the left or right, switch width/height
  // https://jdhao.github.io/2019/07/31/image_rotation_exif_info/
  if (orientation === 6 || orientation === 8) {
    return {
      width: dimensions.height,
      height: dimensions.width,
    }
  }
  return dimensions
}

export default {
  allImagesFromDisk,
  imageFromDb,
  allImagesFromDb,
  resizeImage,
  getDimensions,
}
