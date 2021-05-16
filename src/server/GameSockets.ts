import { logger } from '../common/Util.js'
import WebSocket from 'ws'

const log = logger('GameSocket.js')

// Map<gameId, Socket[]>
const SOCKETS = {} as Record<string, Array<WebSocket>>

function socketExists(gameId: string, socket: WebSocket) {
  if (!(gameId in SOCKETS)) {
    return false
  }
  return SOCKETS[gameId].includes(socket)
}

function removeSocket(gameId: string, socket: WebSocket) {
  if (!(gameId in SOCKETS)) {
    return
  }
  SOCKETS[gameId] = SOCKETS[gameId].filter((s: WebSocket) => s !== socket)
  log.log('removed socket: ', gameId, socket.protocol)
  log.log('socket count: ', Object.keys(SOCKETS[gameId]).length)
}

function addSocket(gameId: string, socket: WebSocket) {
  if (!(gameId in SOCKETS)) {
    SOCKETS[gameId] = []
  }
  if (!SOCKETS[gameId].includes(socket)) {
    SOCKETS[gameId].push(socket)
    log.log('added socket: ', gameId, socket.protocol)
    log.log('socket count: ', Object.keys(SOCKETS[gameId]).length)
  }
}

function getSockets(gameId: string) {
  if (!(gameId in SOCKETS)) {
    return []
  }
  return SOCKETS[gameId]
}

export default {
  addSocket,
  removeSocket,
  socketExists,
  getSockets,
}
