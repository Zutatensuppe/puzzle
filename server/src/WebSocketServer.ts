import { WebSocketServer as WsServer } from 'ws'
import type WebSocket from 'ws'
import type { WsConfig } from './Config'
import { logger } from '@common/Util'
import type { ServerEvent } from '@common/Types'

const log = logger('WebSocketServer.js')

/*
Example config

config = {
  hostname: 'localhost',
  port: 1338,
  connectstring: `ws://localhost:1338/ws`,
}
*/

type CallbackFunc = (...args: any[]) => void

class EvtBus {
  private _on: Record<string, CallbackFunc[]>
  constructor() {
    this._on = {}
  }

  on (type: string, callback: CallbackFunc): void {
    this._on[type] = this._on[type] || []
    this._on[type].push(callback)
  }

  dispatch (type: string, ...args: unknown[]): void {
    for (const cb of this._on[type] || []) {
      cb(...args)
    }
  }
}

class WebSocketServer {
  evt: EvtBus
  private _websocketserver: WsServer|null
  config: WsConfig

  constructor(config: WsConfig) {
    this.config = config
    this._websocketserver = null

    this.evt = new EvtBus()
  }

  on (type: string, callback: CallbackFunc): void {
    this.evt.on(type, callback)
  }

  listen (): void {
    this._websocketserver = new WsServer(this.config)
    this._websocketserver.on('connection', (socket: WebSocket, request: Request): void => {
      const pathname = new URL(this.config.connectstring).pathname
      if (request.url.indexOf(pathname) !== 0) {
        log.log('bad request url: ', request.url)
        socket.close()
        return
      }
      socket.on('message', (data: WebSocket.Data) => {
        const strData = String(data)
        if (strData === 'PING') {
          socket.send('PONG')
          return
        }

        // log.log(`ws`, socket.protocol, strData)
        this.evt.dispatch('message', {socket, data: strData})
      })
      socket.on('close', () => {
        this.evt.dispatch('close', {socket})
      })

      socket.send('SERVER_INIT')
    })
  }

  close (): void {
    if (this._websocketserver) {
      this._websocketserver.close()
    }
  }

  notifyOne (data: ServerEvent, socket: WebSocket): void {
    socket.send(JSON.stringify(data))
  }
}

export default WebSocketServer
