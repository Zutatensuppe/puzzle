import { logger } from './../common/Util'
import WebSocket from 'ws'

const log = logger('GameSocket.js')

export class GameSockets {
  #sockets: Record<string, WebSocket[]> = {}

  socketExists(gameId: string, socket: WebSocket): boolean {
    if (!(gameId in this.#sockets)) {
      return false
    }
    return this.#sockets[gameId].includes(socket)
  }

  removeSocket(gameId: string, socket: WebSocket): void {
    if (!(gameId in this.#sockets)) {
      return
    }
    this.#sockets[gameId] = this.#sockets[gameId].filter((s: WebSocket) => s !== socket)
    log.log('removed socket: ', gameId, socket.protocol)
    log.log('socket count: ', Object.keys(this.#sockets[gameId]).length)
  }

  addSocket(gameId: string, socket: WebSocket): void {
    if (!(gameId in this.#sockets)) {
      this.#sockets[gameId] = []
    }
    if (!this.#sockets[gameId].includes(socket)) {
      this.#sockets[gameId].push(socket)
      log.log('added socket: ', gameId, socket.protocol)
      log.log('socket count: ', Object.keys(this.#sockets[gameId]).length)
    }
  }

  getSockets(gameId: string): WebSocket[] {
    if (!(gameId in this.#sockets)) {
      return []
    }
    return this.#sockets[gameId]
  }
}
