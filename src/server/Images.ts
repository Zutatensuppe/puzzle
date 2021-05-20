import sizeOf from 'image-size'
import fs from 'fs'
import exif from 'exif'
import sharp from 'sharp'

import {UPLOAD_DIR, UPLOAD_URL} from './Dirs'

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

const allImages = (sort: string) => {
  let images = fs.readdirSync(UPLOAD_DIR)
    .filter(f => f.toLowerCase().match(/\.(jpe?g|webp|png)$/))
    .map(f => ({
      filename: f,
      file: `${UPLOAD_DIR}/${f}`,
      url: `${UPLOAD_URL}/${encodeURIComponent(f)}`,
      title: '',
      category: '',
      ts: fs.statSync(`${UPLOAD_DIR}/${f}`).mtime.getTime(),
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
        return a.ts > b.ts ? 1 : -1
      })
      break;

    case 'date_desc':
    default:
      images = images.sort((a, b) => {
        return a.ts < b.ts ? 1 : -1
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
  allImages,
  resizeImage,
  getDimensions,
}
