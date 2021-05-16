import WebSocket from 'ws'
import { logger } from './../common/Util'

const log = logger('WebSocketServer.js')

/*
Example config

config = {
  hostname: 'localhost',
  port: 1338,
  connectstring: `ws://localhost:1338/ws`,
}
*/

class EvtBus {
  private _on: any
  constructor() {
    this._on = {} as any
  }

  on(type: string, callback: Function) {
    this._on[type] = this._on[type] || []
    this._on[type].push(callback)
  }

  dispatch(type: string, ...args: Array<any>) {
    (this._on[type] || []).forEach((cb: Function) => {
      cb(...args)
    })
  }
}

class WebSocketServer {
  evt: EvtBus
  private _websocketserver: WebSocket.Server|null
  config: any

  constructor(config: any) {
    this.config = config
    this._websocketserver = null

    this.evt = new EvtBus()
  }

  on(type: string, callback: Function) {
    this.evt.on(type, callback)
  }

  listen() {
    this._websocketserver = new WebSocket.Server(this.config)
    this._websocketserver.on('connection', (socket: WebSocket, request: Request) => {
      const pathname = new URL(this.config.connectstring).pathname
      if (request.url.indexOf(pathname) !== 0) {
        log.log('bad request url: ', request.url)
        socket.close()
        return
      }
      socket.on('message', (data: any) => {
        log.log(`ws`, socket.protocol, data)
        this.evt.dispatch('message', {socket, data})
      })
      socket.on('close', () => {
        this.evt.dispatch('close', {socket})
      })
    })
  }

  close() {
    if (this._websocketserver) {
      this._websocketserver.close()
    }
  }

  notifyOne(data: any, socket: WebSocket) {
    socket.send(JSON.stringify(data))
  }
}

export default WebSocketServer
