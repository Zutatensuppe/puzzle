import WsClient from './WsClient.js'
import Protocol from './../common/Protocol.js'

/** @type WsClient */
let conn
let changesCallback = () => {}

function onServerChange(callback) {
  changesCallback = callback
}

function send(message) {
  conn.send(JSON.stringify(message))
}

let clientSeq
let events
function connect(gameId, clientId) {
  clientSeq = 0
  events = {}
  conn = new WsClient(WS_ADDRESS, clientId + '|' + gameId)
  return new Promise(r => {
    conn.connect()
    send([Protocol.EV_CLIENT_INIT])
    conn.onSocket('message', async ({ data }) => {
      const msg = JSON.parse(data)
      const msgType = msg[0]
      if (msgType === Protocol.EV_SERVER_INIT) {
        const game = msg[1]
        r(game)
      } else if (msgType === Protocol.EV_SERVER_EVENT) {
        const msgClientId = msg[1]
        const msgClientSeq = msg[2]
        if (msgClientId === clientId && events[msgClientSeq]) {
          delete events[msgClientSeq]
          // we have already calculated that change locally. probably
          return
        }
        changesCallback(msg)
      }
    })
  })
}

function connectReplay(gameId, clientId) {
  clientSeq = 0
  events = {}
  conn = new WsClient(WS_ADDRESS, clientId + '|' + gameId)
  return new Promise(r => {
    conn.connect()
    send([Protocol.EV_CLIENT_INIT_REPLAY])
    conn.onSocket('message', async ({ data }) => {
      const msg = JSON.parse(data)
      const msgType = msg[0]
      if (msgType === Protocol.EV_SERVER_INIT_REPLAY) {
        const game = msg[1]
        const log = msg[2]
        r({game, log})
      }
    })
  })
}

function sendClientEvent(mouse) {
  // when sending event, increase number of sent events
  // and add the event locally
  clientSeq++;
  events[clientSeq] = mouse
  send([Protocol.EV_CLIENT_EVENT, clientSeq, events[clientSeq]])
}

export default {
  connect,
  connectReplay,
  onServerChange,
  sendClientEvent,
}
