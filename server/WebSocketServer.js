import WebSocket from 'ws'

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
    this._interval = null

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
        console.log('bad request url: ', request.url)
        socket.close()
        return
      }

      socket.isAlive = true
      socket.on('pong', function () {
        this.isAlive = true;
      })

      socket.on('message', (data) => {
        console.log(`ws| `, data)
        this.evt.dispatch('message', {socket, data})
      })
    })

    this._interval = setInterval(() => {
      this._websocketserver.clients.forEach((socket) => {
        if (socket.isAlive === false) {
          return socket.terminate()
        }
        socket.isAlive = false
        this.evt.dispatch('close', {socket})
        socket.ping(() => { })
      })
    }, 30000)

    this._websocketserver.on('close', () => {
      clearInterval(this._interval)
    })
  }

  notifyOne(data, socket) {
    if (socket.isAlive) {
      socket.send(JSON.stringify(data))
    }
  }

  notifyAll(data) {
    this._websocketserver.clients.forEach((socket) => {
      this.notifyOne(data, socket)
    })
  }
}

export default WebSocketServer
