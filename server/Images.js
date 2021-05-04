import sizeOf from 'image-size'
import fs from 'fs'
import exif from 'exif'
import sharp from 'sharp'
import {UPLOAD_DIR, UPLOAD_URL} from './Dirs.js'

const resizeImage = async (filename) => {
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

async function getExifOrientation(imagePath) {
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

const allImages = () => {
  const images = fs.readdirSync(UPLOAD_DIR)
    .filter(f => f.toLowerCase().match(/\.(jpe?g|webp|png)$/))
    .map(f => ({
      filename: f,
      file: `${UPLOAD_DIR}/${f}`,
      url: `${UPLOAD_URL}/${encodeURIComponent(f)}`,
    }))
    .sort((a, b) => {
      return fs.statSync(b.file).mtime.getTime() -
        fs.statSync(a.file).mtime.getTime()
    })
  return images
}

async function getDimensions(imagePath) {
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
