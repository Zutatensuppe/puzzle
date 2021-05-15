"use strict"

import WsClient from './WsClient.js'
import Protocol from './../common/Protocol.js'

/** @type WsClient */
let conn
let changesCallback = () => {}
let connectionLostCallback = () => {}

// TODO: change these to something like on(EVT, cb)
function onServerChange(callback) {
  changesCallback = callback
}
function onConnectionLost(callback) {
  connectionLostCallback = callback
}

function send(message) {
  conn.send(JSON.stringify(message))
}

let clientSeq
let events
function connect(address, gameId, clientId) {
  clientSeq = 0
  events = {}
  conn = new WsClient(address, clientId + '|' + gameId)
  return new Promise(resolve => {
    conn.connect()
    conn.onSocket('message', async ({ data }) => {
      const msg = JSON.parse(data)
      const msgType = msg[0]
      if (msgType === Protocol.EV_SERVER_INIT) {
        const game = msg[1]
        resolve(game)
      } else if (msgType === Protocol.EV_SERVER_EVENT) {
        const msgClientId = msg[1]
        const msgClientSeq = msg[2]
        if (msgClientId === clientId && events[msgClientSeq]) {
          delete events[msgClientSeq]
          // we have already calculated that change locally. probably
          return
        }
        changesCallback(msg)
      } else {
        throw `[ 2021-05-09 invalid connect msgType ${msgType} ]`
      }
    })
    conn.onclose(() => {
      connectionLostCallback()
    })
    send([Protocol.EV_CLIENT_INIT])
  })
}

function connectReplay(address, gameId, clientId) {
  clientSeq = 0
  events = {}
  conn = new WsClient(address, clientId + '|' + gameId)
  return new Promise(resolve => {
    conn.connect()
    conn.onSocket('message', async ({ data }) => {
      const msg = JSON.parse(data)
      const msgType = msg[0]
      if (msgType === Protocol.EV_SERVER_INIT_REPLAY) {
        const game = msg[1]
        const log = msg[2]
        resolve({game, log})
      } else {
        throw `[ 2021-05-09 invalid connectReplay msgType ${msgType} ]`
      }
    })
    send([Protocol.EV_CLIENT_INIT_REPLAY])
  })
}

function disconnect() {
  if (conn) {
    conn.disconnect()
  }
  clientSeq = 0
  events = {}
}

function sendClientEvent(evt) {
  // when sending event, increase number of sent events
  // and add the event locally
  clientSeq++;
  events[clientSeq] = evt
  send([Protocol.EV_CLIENT_EVENT, clientSeq, events[clientSeq]])
}

export default {
  connect,
  connectReplay,
  disconnect,
  sendClientEvent,
  onServerChange,
  onConnectionLost,
}
