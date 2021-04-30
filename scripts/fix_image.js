#!/bin/env node

import GameCommon from '../common/GameCommon.js'
import { logger } from '../common/Util.js'
import GameStorage from '../server/GameStorage.js'

const log = logger('fix_image.js')

function fix(gameId) {
  GameStorage.loadGame(gameId)
  let changed = false

  let imgUrl = GameCommon.getImageUrl(gameId)
  if (imgUrl.match(/^\/example-images\//)) {
    log.log(`found bad imgUrl: ${imgUrl}`)
    imgUrl = imgUrl.replace(/^\/example-images\//, '/uploads/')
    GameCommon.setImageUrl(gameId, imgUrl)
    changed = true
  }
  if (changed) {
    GameStorage.persistGame(gameId)
  }
}

fix(process.argv[2])
