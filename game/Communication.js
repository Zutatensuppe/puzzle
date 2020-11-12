import WsClient from './WsClient.js'

const EV_SERVER_STATE_CHANGED = 1
const EV_SERVER_INIT = 4
const EV_CLIENT_MOUSE = 2
const EV_CLIENT_INIT = 3

let conn
let changesCallback = () => {}

function onChanges(callback) {
  changesCallback = callback
}

function connect(gameId, playerId) {
  conn = new WsClient(WS_ADDRESS, playerId + '|' + gameId)
  return new Promise(r => {
    conn.connect()
    conn.send(JSON.stringify([EV_CLIENT_INIT]))
    conn.onSocket('message', async ({ data }) => {
      const [type, typeData] = JSON.parse(data)
      if (type === EV_SERVER_INIT) {
        const game = typeData
        r(game)
      } else if (type === EV_SERVER_STATE_CHANGED) {
        const changes = typeData
        changesCallback(changes)
      }
    })
  })
}

function addMouse(mouse) {
    conn.send(JSON.stringify([EV_CLIENT_MOUSE, mouse]))
}

export default {
  connect,
  onChanges,
  addMouse,
}
