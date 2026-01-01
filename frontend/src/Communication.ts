'use strict'

import type { ClientEvent, ConnectionState, EncodedGame, EncodedGameLegacy, GameEvent, ServerEvent, ServerSyncEvent, ServerUpdateEvent } from '@common/Types'
import { logger } from '@common/Util'
import { CLIENT_EVENT_TYPE, SERVER_EVENT_TYPE } from '@common/Protocol'
import type { GamePlay } from './GamePlay'
import { ConnectionStatesEnum } from '@common/Constants'

const log = logger('Communication.js')

const CODE_GOING_AWAY = 1001
const CODE_CUSTOM_DISCONNECT = 4000
const CODE_SERVER_ERROR = 4001

let ws: WebSocket

let missedMessages: ServerUpdateEvent[] = []
let changesCallback = (msg: ServerUpdateEvent) => {
  missedMessages.push(msg)
}
let syncCallback = (_evt: ServerSyncEvent) => {
  // noop
}

let missedStateChanges: ConnectionState[] = []
let connectionStateChangeCallback = (connectionState: ConnectionState) => {
  missedStateChanges.push(connectionState)
}

function onServerSync(callback: (evt: ServerSyncEvent) => void): void {
  syncCallback = callback
}

function onServerUpdate(callback: (msg: ServerUpdateEvent) => void): void {
  changesCallback = callback
  for (const missedMessage of missedMessages) {
    changesCallback(missedMessage)
  }
  missedMessages = []
}

function onConnectionStateChange(callback: (connectionState: ConnectionState) => void): void {
  connectionStateChangeCallback = callback
  for (const missedStateChange of missedStateChanges) {
    connectionStateChangeCallback(missedStateChange)
  }
  missedStateChanges = []
}

let connectionState: ConnectionState = { state: ConnectionStatesEnum.NOT_CONNECTED }
const setConnectionState = (state: ConnectionState): void => {
  if (
    // first simply compare state, to avoid JSON.stringify overhead
    connectionState.state !== state.state ||
    JSON.stringify(connectionState) !== JSON.stringify(state)
  ) {
    connectionState = state
    connectionStateChangeCallback(state)
  }
}
function send(message: ClientEvent): void {
  if (connectionState.state === ConnectionStatesEnum.CONNECTED) {
    try {
      ws.send(JSON.stringify(message))
    } catch {
      log.info('unable to send message.. maybe because ws is invalid?')
    }
  }
}

let clientSeq: number
let events: Record<number, GameEvent>

let timerId: ReturnType<typeof setTimeout> | null = null
let gotPong: boolean = false
let pongWaitTimerId: ReturnType<typeof setTimeout> | null = null

function keepAlive(timeout = 20000) {
  if (ws && ws.readyState == ws.OPEN) {
    gotPong = false
    ws.send('PING')
    if (pongWaitTimerId) {
      clearTimeout(pongWaitTimerId)
    }
    pongWaitTimerId = setTimeout(() => {
      if (!gotPong && ws) {
        // close without custom disconnect, to trigger reconnect
        ws.close()
      }
    }, 1000) // server should answer more quickly in reality
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
): Promise<EncodedGame | EncodedGameLegacy> {
  clientSeq = 0
  events = {}
  setConnectionState({ state: ConnectionStatesEnum.CONNECTING })
  return new Promise((resolve, reject) => {
    ws = new WebSocket(game.getWsAddres(), game.getClientId() + '|' + game.getGameId())
    ws.onopen = () => {
      setConnectionState({ state: ConnectionStatesEnum.CONNECTED })
      if (game.joinPassword) {
        send([CLIENT_EVENT_TYPE.INIT, { password: game.joinPassword }])
      } else {
        send([CLIENT_EVENT_TYPE.INIT])
      }
    }
    ws.onmessage = (e: MessageEvent) => {
      if (e.data === 'SERVER_INIT') {
        keepAlive()
        return
      }

      if (e.data === 'PONG') {
        gotPong = true
        return
      }

      const msg: ServerEvent = JSON.parse(e.data)
      const msgType = msg[0]
      if (msgType === SERVER_EVENT_TYPE.INIT) {
        const game = msg[1]
        resolve(game)
      } else if (msgType === SERVER_EVENT_TYPE.SYNC) {
        syncCallback(msg)
      } else if (msgType === SERVER_EVENT_TYPE.UPDATE) {
        const msgClientId = msg[1]
        const msgClientSeq = msg[2]
        if (msgClientId === game.getClientId() && events[msgClientSeq]) {
          delete events[msgClientSeq]
          // we have already calculated that change locally. probably
          return
        }
        changesCallback(msg)
      } else if (msgType === SERVER_EVENT_TYPE.ERROR) {
        if (e.target) {
          const socket = e.target as WebSocket
          socket.close(CODE_SERVER_ERROR)
        }
        reject(msg[1])
      } else {
        throw `[ 2021-05-09 invalid connect msgType ${msgType} ]`
      }
    }

    ws.onerror = () => {
      cancelKeepAlive()
      setConnectionState({ state: ConnectionStatesEnum.DISCONNECTED })
      throw `[ 2021-05-15 onerror ]`
    }

    ws.onclose = (e: CloseEvent) => {
      cancelKeepAlive()
      if (e.code === CODE_SERVER_ERROR) {
        // do nothing!
      } else if (e.code === CODE_CUSTOM_DISCONNECT || e.code === CODE_GOING_AWAY) {
        setConnectionState({ state: ConnectionStatesEnum.CLOSED })
      } else {
        setConnectionState({ state: ConnectionStatesEnum.DISCONNECTED })
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
  send([CLIENT_EVENT_TYPE.UPDATE, clientSeq, events[clientSeq]])
}

function sendImageSnapshot(imageData: string, ts: number): void {
  send([CLIENT_EVENT_TYPE.IMAGE_SNAPSHOT, imageData, ts])
}

export default {
  connect,
  disconnect,
  sendClientEvent,
  sendImageSnapshot,
  onServerUpdate,
  onServerSync,
  onConnectionStateChange,
  CODE_CUSTOM_DISCONNECT,
}
