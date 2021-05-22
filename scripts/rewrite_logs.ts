import fs from 'fs'
import Protocol from '../src/common/Protocol'
import { logger } from '../src/common/Util'
import { DATA_DIR } from '../src/server/Dirs'

const log = logger('rewrite_logs')

const filename = (gameId) => `${DATA_DIR}/log_${gameId}.log`

const rewrite = (gameId) => {
  const file = filename(gameId)
  log.log(file)
  if (!fs.existsSync(file)) {
    return []
  }
  let playerIds = [];
  let startTs = null
  const lines = fs.readFileSync(file, 'utf-8').split("\n")
  const linesNew = lines.filter(line => !!line).map((line) => {
    const json = JSON.parse(line)
    const m = {
      createGame: Protocol.LOG_HEADER,
      addPlayer: Protocol.LOG_ADD_PLAYER,
      handleInput: Protocol.LOG_HANDLE_INPUT,
    }
    const action = json[0]
    if (action in m) {
      json[0] = m[action]
      if (json[0] === Protocol.LOG_HANDLE_INPUT) {
        const inputm = {
          down: Protocol.INPUT_EV_MOUSE_DOWN,
          up: Protocol.INPUT_EV_MOUSE_UP,
          move: Protocol.INPUT_EV_MOUSE_MOVE,
          zoomin: Protocol.INPUT_EV_ZOOM_IN,
          zoomout: Protocol.INPUT_EV_ZOOM_OUT,
          bg_color: Protocol.INPUT_EV_BG_COLOR,
          player_color: Protocol.INPUT_EV_PLAYER_COLOR,
          player_name: Protocol.INPUT_EV_PLAYER_NAME,
        }
        const inputa = json[2][0]
        if (inputa in inputm) {
          json[2][0] = inputm[inputa]
        } else {
          throw '[ invalid input log line: "' + line + '" ]'
        }
      }
    } else {
      throw '[ invalid general log line: "' + line + '" ]'
    }

    if (json[0] === Protocol.LOG_ADD_PLAYER) {
      if (playerIds.indexOf(json[1]) === -1) {
        playerIds.push(json[1])
      } else {
        json[0] = Protocol.LOG_UPDATE_PLAYER
        json[1] = playerIds.indexOf(json[1])
      }
    }

    if (json[0] === Protocol.LOG_HANDLE_INPUT) {
      json[1] = playerIds.indexOf(json[1])
      if (json[1] === -1) {
        throw '[ invalid player ... "' + line + '" ]'
      }
    }

    if (json[0] === Protocol.LOG_HEADER) {
      startTs = json[json.length - 1]
      json[4] = json[3]
      json[3] = json[2]
      json[2] = json[1]
      json[1] = 1
    } else {
      json[json.length - 1] = json[json.length - 1] - startTs
    }
    return JSON.stringify(json)
  })

  fs.writeFileSync(file, linesNew.join("\n") + "\n")
}

rewrite(process.argv[2])
