#!/bin/env node

import Images from './../server/Images.js'

const images = Images.allImages()
images.forEach(async (image) => {
  console.log(image)
  Images.resizeImage(image.filename)
})
