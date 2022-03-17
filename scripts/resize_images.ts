import Images from './../src/server/Images'

const images = Images.allImagesFromDisk([], 'date_asc')
images.forEach(async (image) => {
  console.log(image)
  Images.resizeImage(image.filename)
})
