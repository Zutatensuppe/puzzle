#!/bin/env node

import fs from 'fs'
import sharp from 'sharp'
import exif from 'exif'

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

const dir = `${process.env.RUN_DIR}/data/uploads`
const images = fs.readdirSync(dir)
images.forEach(async (image) => {
  if (!image.match(/\.(jpe?g|webp|png)$/)) {
    return
  }
  console.log(image)

  const imagePath = `${dir}/${image}`
  const iamgeOutPath = `${dir}/r/${image}`
  const orientation = await getExifOrientation(imagePath)

  let sharpImg = sharp(imagePath)
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
  sizes.forEach(([w, h]) => {
    sharpImg.resize(w, h, {fit: 'contain'}).toFile(`${iamgeOutPath}-${w}x${h}.webp`)
  })
})
