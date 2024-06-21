import { logger } from '../../common/src/Util'
import { GameId } from '../../common/src/Types'
import WebSocket from 'ws'

const log = logger('GameSocket.js')

export class GameSockets {
  private sockets: Record<GameId, WebSocket[]> = {}
  private idle: Record<GameId, number> = {}

  private static MAX_IDLE_TICKS = 6 // * idlecheck interval = 6 * 10s = 60s

  updateIdle(): GameId[] {
    const idleGameIds = []
    let gameId: GameId
    for (gameId in this.sockets) {
      if (this.sockets[gameId].length === 0) {
        this.idle[gameId] = (this.idle[gameId] || 0) + 1
        if (this.idle[gameId] > GameSockets.MAX_IDLE_TICKS) {
          idleGameIds.push(gameId)
        }
      }
    }
    return idleGameIds
  }

  removeSocketInfo(gameId: GameId): void {
    if (gameId in this.sockets) {
      delete this.sockets[gameId]
    }
    if (gameId in this.idle) {
      delete this.idle[gameId]
    }
  }

  socketExists(gameId: GameId, socket: WebSocket): boolean {
    if (!(gameId in this.sockets)) {
      return false
    }
    return this.sockets[gameId].includes(socket)
  }

  removeSocket(gameId: GameId, socket: WebSocket): void {
    if (!(gameId in this.sockets)) {
      return
    }
    this.sockets[gameId] = this.sockets[gameId].filter((s: WebSocket) => s !== socket)
    log.log('removed socket: ', gameId, socket.protocol)
    log.log('socket count: ', Object.keys(this.sockets[gameId]).length)
  }

  addSocket(gameId: GameId, socket: WebSocket): void {
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

  getSockets(gameId: GameId): WebSocket[] {
    if (!(gameId in this.sockets)) {
      return []
    }
    return this.sockets[gameId]
  }

  getSocketCount(): number {
    return Object.keys(this.sockets).reduce((acc, gameId) => acc + this.sockets[gameId as GameId].length, 0)
  }

  getSocketCountsByGameIds(): Record<GameId, number> {
    const counts: Record<GameId, number> = {}
    let gameId: GameId
    for (gameId in this.sockets) {
      counts[gameId] = this.sockets[gameId].length
    }
    return counts
  }
}
