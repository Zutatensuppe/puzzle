import config from '../src/server/Config'
import Db from '../src/server/Db'
import Images from '../src/server/Images'

const db = new Db(config.db.connectStr, config.dir.DB_PATCHES_DIR)

;(async () => {
  await db.connect()
  await db.patch(true)

  const categories = []
  const sort = 'date_desc'
  let images = Images.allImagesFromDisk(categories, sort)
  images.forEach((image: any) => {
    db.upsert('images', {
      filename: image.filename,
      filename_original: image.filename,
      title: image.title,
      created: image.created / 1000,
    }, {
      filename: image.filename
    })
  })

  images = await Images.allImagesFromDb(db, categories, sort, true)
  console.log(images)
  images = await Images.allImagesFromDb(db, categories, sort, false)
  console.log(images)
  await db.close()
})()
