'use strict'

import { ClientEvent, EncodedGame, GameEvent, ServerEvent } from '../../common/src/Types'
import { logger } from '../../common/src/Util'
import Protocol from '../../common/src/Protocol'
import { GamePlay } from './GamePlay'

const log = logger('Communication.js')

const CODE_GOING_AWAY = 1001
const CODE_CUSTOM_DISCONNECT = 4000

const CONN_STATE_NOT_CONNECTED = 0 // not connected yet
const CONN_STATE_DISCONNECTED = 1 // not connected, but was connected before
const CONN_STATE_CONNECTED = 2 // connected
const CONN_STATE_CONNECTING = 3 // connecting
const CONN_STATE_CLOSED = 4 // not connected (closed on purpose)

let ws: WebSocket

let missedMessages: ServerEvent[] = []
let changesCallback = (msg: ServerEvent) => {
  missedMessages.push(msg)
}

let missedStateChanges: Array<number> = []
let connectionStateChangeCallback = (state: number) => {
  missedStateChanges.push(state)
}

function onServerChange(callback: (msg: ServerEvent) => void): void {
  changesCallback = callback
  for (const missedMessage of missedMessages) {
    changesCallback(missedMessage)
  }
  missedMessages = []
}

function onConnectionStateChange(callback: (state: number) => void): void {
  connectionStateChangeCallback = callback
  for (const missedStateChange of missedStateChanges) {
    connectionStateChangeCallback(missedStateChange)
  }
  missedStateChanges = []
}

let connectionState = CONN_STATE_NOT_CONNECTED
const setConnectionState = (state: number): void => {
  if (connectionState !== state) {
    connectionState = state
    connectionStateChangeCallback(state)
  }
}
function send(message: ClientEvent): void {
  if (connectionState === CONN_STATE_CONNECTED) {
    try {
      ws.send(JSON.stringify(message))
    } catch (e) {
      log.info('unable to send message.. maybe because ws is invalid?')
    }
  }
}

let clientSeq: number
let events: Record<number, GameEvent>

let timerId: any = 0

function keepAlive(timeout = 20000) {
    if (ws.readyState == ws.OPEN) {
        ws.send('')
    }
    timerId = setTimeout(keepAlive, timeout)
}

function cancelKeepAlive() {
    if (timerId) {
        clearTimeout(timerId)
    }
}

function connect(
  game: GamePlay,
): Promise<EncodedGame> {
  clientSeq = 0
  events = {}
  setConnectionState(CONN_STATE_CONNECTING)
  return new Promise(resolve => {
    ws = new WebSocket(game.getWsAddres(), game.getClientId() + '|' + game.getGameId())
    ws.onopen = () => {
      setConnectionState(CONN_STATE_CONNECTED)
      send([Protocol.EV_CLIENT_INIT])
      keepAlive()
    }
    ws.onmessage = (e: MessageEvent) => {
      const msg: ServerEvent = JSON.parse(e.data)
      const msgType = msg[0]
      if (msgType === Protocol.EV_SERVER_INIT) {
        const game = msg[1]
        resolve(game)
      } else if (msgType === Protocol.EV_SERVER_EVENT) {
        const msgClientId = msg[1]
        const msgClientSeq = msg[2]
        if (msgClientId === game.getClientId() && events[msgClientSeq]) {
          delete events[msgClientSeq]
          // we have already calculated that change locally. probably
          return
        }
        changesCallback(msg)
      } else {
        throw `[ 2021-05-09 invalid connect msgType ${msgType} ]`
      }
    }

    ws.onerror = () => {
      cancelKeepAlive()
      setConnectionState(CONN_STATE_DISCONNECTED)
      throw `[ 2021-05-15 onerror ]`
    }

    ws.onclose = (e: CloseEvent) => {
      cancelKeepAlive()
      if (e.code === CODE_CUSTOM_DISCONNECT || e.code === CODE_GOING_AWAY) {
        setConnectionState(CONN_STATE_CLOSED)
      } else {
        setConnectionState(CONN_STATE_DISCONNECTED)
      }
    }
  })
}

function disconnect(): void {
  if (ws) {
    ws.close(CODE_CUSTOM_DISCONNECT)
  }
  clientSeq = 0
  events = {}
}

function sendClientEvent(evt: GameEvent): void {
  // when sending event, increase number of sent events
  // and add the event locally
  clientSeq++
  events[clientSeq] = evt
  send([Protocol.EV_CLIENT_EVENT, clientSeq, events[clientSeq]])
}

export default {
  connect,
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
