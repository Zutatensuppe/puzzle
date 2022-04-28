import exif from 'exif'

const f = './tests/fixtures/50d6d48c-1a67-11e5-820f-2ad9c220252a.JPG'

const run = async () => {
  new exif.ExifImage({ image: f }, (error, exifData) => {
    if (error) {
      console.error(error)
    } else {
      console.log(exifData)
    }
  })
}

run()
