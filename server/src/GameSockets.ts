import { logger } from '../../common/src/Util'
import WebSocket from 'ws'

const log = logger('GameSocket.js')

export class GameSockets {
  private sockets: Record<string, WebSocket[]> = {}
  private idle: Record<string, number> = {}

  private static MAX_IDLE_TICKS = 6 // * idlecheck interval = 6 * 10s = 60s

  updateIdle(): string[] {
    const idleGameIds = []
    for (const gameId in this.sockets) {
      if (this.sockets[gameId].length === 0) {
        this.idle[gameId] = (this.idle[gameId] || 0) + 1
        if (this.idle[gameId] > GameSockets.MAX_IDLE_TICKS) {
          idleGameIds.push(gameId)
        }
      }
    }
    return idleGameIds
  }

  removeSocketInfo(gameId: string): void {
    if (gameId in this.sockets) {
      delete this.sockets[gameId]
    }
    if (gameId in this.idle) {
      delete this.idle[gameId]
    }
  }

  socketExists(gameId: string, socket: WebSocket): boolean {
    if (!(gameId in this.sockets)) {
      return false
    }
    return this.sockets[gameId].includes(socket)
  }

  removeSocket(gameId: string, socket: WebSocket): void {
    if (!(gameId in this.sockets)) {
      return
    }
    this.sockets[gameId] = this.sockets[gameId].filter((s: WebSocket) => s !== socket)
    log.log('removed socket: ', gameId, socket.protocol)
    log.log('socket count: ', Object.keys(this.sockets[gameId]).length)
  }

  addSocket(gameId: string, socket: WebSocket): void {
    if (gameId in this.idle) {
      delete this.idle[gameId]
    }
    if (!(gameId in this.sockets)) {
      this.sockets[gameId] = []
    }
    if (!this.sockets[gameId].includes(socket)) {
      for (const s of this.sockets[gameId]) {
        // close any existing sockets with the same protocol (= same player)
        if (s.protocol === socket.protocol) {
          s.close()
        }
      }
      this.sockets[gameId].push(socket)
      log.log('added socket: ', gameId, socket.protocol)
      log.log('socket count: ', Object.keys(this.sockets[gameId]).length)
    }
  }

  getSockets(gameId: string): WebSocket[] {
    if (!(gameId in this.sockets)) {
      return []
    }
    return this.sockets[gameId]
  }

  getSocketCount(): number {
    return Object.keys(this.sockets).reduce((acc, gameId) => acc + this.sockets[gameId].length, 0)
  }
}
