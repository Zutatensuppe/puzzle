import fs from 'fs'
import config from '../src/server/Config'
import Db from '../src/server/Db'
import Images from '../src/server/Images'

const db = new Db(config.db.connectStr, config.dir.DB_PATCHES_DIR)

;(async () => {
  await db.connect()
  await db.patch(true)
  const images = await db.getMany('images')
  for (const image of images) {
    // console.log(`${config.dir.UPLOAD_DIR}/${image.filename}`)
    if (fs.existsSync(`${config.dir.UPLOAD_DIR}/${image.filename}`)) {
      await Images.resizeImage(image.filename)
    }
  }
  await db.close()
})()
