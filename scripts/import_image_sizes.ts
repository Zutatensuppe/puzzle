import { DB_FILE, DB_PATCHES_DIR, UPLOAD_DIR } from '../src/server/Dirs'
import Db from '../src/server/Db'
import Images from '../src/server/Images'

const db = new Db(DB_FILE, DB_PATCHES_DIR)
db.patch(true)

;(async () => {
  let images = db.getMany('images')
  for (let image of images) {
    console.log(image.filename)
    let dim = await Images.getDimensions(`${UPLOAD_DIR}/${image.filename}`)
    console.log(await Images.getDimensions(`${UPLOAD_DIR}/${image.filename}`))
    image.width = dim.w
    image.height = dim.h
    db.upsert('images', image, { id: image.id })
  }
})()
