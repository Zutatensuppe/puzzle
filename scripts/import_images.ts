import { DB_FILE, DB_PATCHES_DIR } from '../src/server/Dirs'
import Db from '../src/server/Db'
import Images from '../src/server/Images'

const db = new Db(DB_FILE, DB_PATCHES_DIR)
db.patch(true)

const cat = ''
const sort = 'date_desc'
let images = Images.allImagesFromDisk(cat, sort)
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

images = Images.allImagesFromDb(db, cat, sort)
console.log(images)
