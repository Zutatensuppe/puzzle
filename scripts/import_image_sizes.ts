import config from '../src/server/Config'
import Db from '../src/server/Db'
import Images from '../src/server/Images'

const db = new Db(config.db.connectStr, config.dir.DB_PATCHES_DIR)

;(async () => {
  await db.connect()
  await db.patch(true)
  const images = await db.getMany('images')
  for (const image of images) {
    console.log(image.filename)
    const dim = await Images.getDimensions(`${config.dir.UPLOAD_DIR}/${image.filename}`)
    console.log(await Images.getDimensions(`${config.dir.UPLOAD_DIR}/${image.filename}`))
    image.width = dim.w
    image.height = dim.h
    await db.upsert('images', image, { id: image.id })
  }
  await db.close()
})()
