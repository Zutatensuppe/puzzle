"use strict"

import { logger } from '../common/Util.js'
import Protocol from './../common/Protocol.js'

const log = logger('Communication.js')

const CODE_GOING_AWAY = 1001
const CODE_CUSTOM_DISCONNECT = 4000

const CONN_STATE_NOT_CONNECTED = 0 // not connected yet
const CONN_STATE_DISCONNECTED = 1 // not connected, but was connected before
const CONN_STATE_CONNECTED = 2 // connected
const CONN_STATE_CONNECTING = 3 // connecting
const CONN_STATE_CLOSED = 4 // not connected (closed on purpose)

/** @type WebSocket */
let ws
let changesCallback = () => {}
let connectionStateChangeCallback = () => {}

// TODO: change these to something like on(EVT, cb)
function onServerChange(callback) {
  changesCallback = callback
}
function onConnectionStateChange(callback) {
  connectionStateChangeCallback = callback
}

let connectionState = CONN_STATE_NOT_CONNECTED
const setConnectionState = (v) => {
  if (connectionState !== v) {
    connectionState = v
    connectionStateChangeCallback(v)
  }
}
function send(message) {
  if (connectionState === CONN_STATE_CONNECTED) {
    try {
      ws.send(JSON.stringify(message))
    } catch (e) {
      log.info('unable to send message.. maybe because ws is invalid?')
    }
  }
}


let clientSeq
let events
function connect(address, gameId, clientId) {
  clientSeq = 0
  events = {}
  setConnectionState(CONN_STATE_CONNECTING)
  return new Promise(resolve => {
    ws = new WebSocket(address, clientId + '|' + gameId)
    ws.onopen = (e) => {
      setConnectionState(CONN_STATE_CONNECTED)
      connectionStateChangeCallback()
      send([Protocol.EV_CLIENT_INIT])
    }
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data)
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
    }

    ws.onerror = (e) => {
      setConnectionState(CONN_STATE_DISCONNECTED)
      throw `[ 2021-05-15 onerror ]`
    }

    ws.onclose = (e) => {
      if (e.code === CODE_CUSTOM_DISCONNECT || e.code === CODE_GOING_AWAY) {
        setConnectionState(CONN_STATE_CLOSED)
      } else {
        setConnectionState(CONN_STATE_DISCONNECTED)
      }
    }
  })
}

// TOOD: change replay stuff
function connectReplay(address, gameId, clientId) {
  clientSeq = 0
  events = {}
  setConnectionState(CONN_STATE_CONNECTING)
  return new Promise(resolve => {
    ws = new WebSocket(address, clientId + '|' + gameId)
    ws.onopen = (e) => {
      setConnectionState(CONN_STATE_CONNECTED)
      send([Protocol.EV_CLIENT_INIT_REPLAY])
    }
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      const msgType = msg[0]
      if (msgType === Protocol.EV_SERVER_INIT_REPLAY) {
        const game = msg[1]
        const log = msg[2]
        resolve({game, log})
      } else {
        throw `[ 2021-05-09 invalid connectReplay msgType ${msgType} ]`
      }
    }

    ws.onerror = (e) => {
      setConnectionState(CONN_STATE_DISCONNECTED)
      throw `[ 2021-05-15 onerror ]`
    }

    ws.onclose = (e) => {
      if (e.code === CODE_CUSTOM_DISCONNECT || e.code === CODE_GOING_AWAY) {
        setConnectionState(CONN_STATE_CLOSED)
      } else {
        setConnectionState(CONN_STATE_DISCONNECTED)
      }
    }
  })
}

function disconnect() {
  if (ws) {
    ws.close(CODE_CUSTOM_DISCONNECT)
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
  onConnectionStateChange,
  CODE_CUSTOM_DISCONNECT,

  CONN_STATE_NOT_CONNECTED,
  CONN_STATE_DISCONNECTED,
  CONN_STATE_CLOSED,
  CONN_STATE_CONNECTED,
  CONN_STATE_CONNECTING,
}
