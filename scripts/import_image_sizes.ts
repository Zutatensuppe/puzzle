import config from '../server/src/Config'
import Db from '../server/src/Db'
import { Images } from '../server/src/Images'
import { ImagesRepo } from '../server/src/repo/ImagesRepo'

const db = new Db(config.db.connectStr, config.dir.DB_PATCHES_DIR)

;(async () => {
  await db.connect()
  await db.patch(true)
  const imgRepo = new ImagesRepo(db)
  const img = new Images(imgRepo)
  const images = await db.getMany('images')
  for (const image of images) {
    console.log(image.filename)
    const dim = await img.getDimensions(`${config.dir.UPLOAD_DIR}/${image.filename}`)
    console.log(await img.getDimensions(`${config.dir.UPLOAD_DIR}/${image.filename}`))
    image.width = dim.w
    image.height = dim.h
    await db.upsert('images', image, { id: image.id })
  }
  await db.close()
})()
