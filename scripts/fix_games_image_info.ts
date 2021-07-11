import GameCommon from '../src/common/GameCommon'
import GameLog from '../src/server/GameLog'
import { Game } from '../src/common/Types'
import { logger } from '../src/common/Util'
import { DB_FILE, DB_PATCHES_DIR, UPLOAD_DIR } from '../src/server/Dirs'
import Db from '../src/server/Db'
import GameStorage from '../src/server/GameStorage'
import fs from 'fs'

const log = logger('fix_games_image_info.ts')

import Images from '../src/server/Images'

console.log(DB_FILE)

const db = new Db(DB_FILE, DB_PATCHES_DIR)
db.patch(true)

// ;(async () => {
//   let images = db.getMany('images')
//   for (let image of images) {
//     console.log(image.filename)
//     let dim = await Images.getDimensions(`${UPLOAD_DIR}/${image.filename}`)
//     console.log(await Images.getDimensions(`${UPLOAD_DIR}/${image.filename}`))
//     image.width = dim.w
//     image.height = dim.h
//     db.upsert('images', image, { id: image.id })
//   }
// })()

function fixOne(gameId: string) {
  let g = GameCommon.get(gameId)
  if (!g) {
    return
  }

  if (!g.puzzle.info.image && g.puzzle.info.imageUrl) {
    log.log('game id: ', gameId)
    const parts = g.puzzle.info.imageUrl.split('/')
    const fileName = parts[parts.length - 1]
    const imageRow = db.get('images', {filename: fileName})
    if (!imageRow) {
      return
    }

    g.puzzle.info.image = Images.imageFromDb(db, imageRow.id)

    log.log(g.puzzle.info.image.title, imageRow.id)

    GameStorage.persistGame(gameId)
  } else if (g.puzzle.info.image?.id) {
    const imageId = g.puzzle.info.image.id

    g.puzzle.info.image = Images.imageFromDb(db, imageId)

    log.log(g.puzzle.info.image.title, imageId)

    GameStorage.persistGame(gameId)
  }

  // fix log
  const file = GameLog.filename(gameId, 0)
  if (!fs.existsSync(file)) {
    return
  }

  const lines = fs.readFileSync(file, 'utf-8').split("\n")
  const l = lines.filter(line => !!line).map(line => {
    return JSON.parse(`[${line}]`)
  })
  if (l && l[0] && !l[0][3].id) {
    log.log(l[0][3])
    l[0][3] = g.puzzle.info.image
    const newlines = l.map(ll => {
      return JSON.stringify(ll).slice(1, -1)
    }).join("\n") + "\n"
    console.log(g.puzzle.info.image)
    // process.exit(0)
    fs.writeFileSync(file, newlines)
  }
}

function fix() {
  GameStorage.loadGames()
  GameCommon.getAllGames().forEach((game: Game) => {
    fixOne(game.id)
  })
}

fix()
