import WsClient from './WsClient.js'

let conn
let changesCallback = () => {}

function onChanges(callback) {
  changesCallback = callback
}

function connect(gameId, playerId) {
  conn = new WsClient(WS_ADDRESS, playerId + '|' + gameId)
  return new Promise(r => {
    conn.connect()
    conn.send(JSON.stringify({ type: 'init' }))
    conn.onSocket('message', async ({ data }) => {
      const d = JSON.parse(data)
      if (d.type === 'init') {
        r(d.game)
      } else if (d.type === 'state_changed' && d.origin !== playerId) {
        changesCallback(d.changes)
      }
    })
  })
}

const _STATE = {
  changed: false,
  changes: [],
}

function addChange(change) {
  _STATE.changes.push(change)
  _STATE.changed = true
}

function sendChanges() {
  if (_STATE.changed) {
    conn.send(JSON.stringify({ type: 'state', state: _STATE }))
    _STATE.changes = []
    _STATE.changed = false
  }
}

export default {
  connect,
  onChanges,
  addChange,
  sendChanges,
}
