import WebSocket from 'ws'
import { logger } from '../common/Util.js'

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
  constructor() {
    this._on = {}
  }

  on(type, callback) {
    this._on[type] = this._on[type] || []
    this._on[type].push(callback)
  }

  dispatch(type, ...args) {
    (this._on[type] || []).forEach(cb => {
      cb(...args)
    })
  }
}

class WebSocketServer {
  constructor(config) {
    this.config = config
    this._websocketserver = null

    this.evt = new EvtBus()
  }

  on(type, callback) {
    this.evt.on(type, callback)
  }

  listen() {
    this._websocketserver = new WebSocket.Server(this.config)
    this._websocketserver.on('connection', (socket, request, client) => {
      const pathname = new URL(this.config.connectstring).pathname
      if (request.url.indexOf(pathname) !== 0) {
        log.log('bad request url: ', request.url)
        socket.close()
        return
      }
      socket.on('message', (data) => {
        log.log(`ws`, socket.protocol, data)
        this.evt.dispatch('message', {socket, data})
      })
      socket.on('close', () => {
        this.evt.dispatch('close', {socket})
      })
    })
  }

  close() {
    this._websocketserver.close()
  }

  notifyOne(data, socket) {
    socket.send(JSON.stringify(data))
  }
}

export default WebSocketServer
