import WebSocketServer from './WebSocketServer.js'

import express from 'express'
import config from './config.js'
import Util from './../common/Util.js'
import Game from './Game.js'

const EV_SERVER_STATE_CHANGED = 1
const EV_SERVER_INIT = 4
const EV_CLIENT_MOUSE = 2
const EV_CLIENT_INIT = 3

// desired number of tiles
// actual calculated number can be higher
const TARGET_TILES = 1000

const IMAGES = [
  '/example-images/ima_86ec3fa.jpeg',
  '/example-images/bleu.png',
  '/example-images/saechsische_schweiz.jpg',
  '/example-images/132-2048x1365.jpg',
]

const games = {}

const port = config.http.port
const hostname = config.http.hostname
const app = express()
const statics = express.static('./../game/')
app.use('/g/:gid', (req, res, next) => {
  res.send(`
    <html><head><style>
    html,body {margin: 0; overflow: hidden;}
    html, body, #main { background: #222 }
    canvas {cursor: none;}
    </style></head><body>
    <script>window.GAME_ID = '${req.params.gid}'</script>
    <script>window.WS_ADDRESS = '${config.ws.connectstring}'</script>
    <script src="/index.js" type="module"></script>
    </body>
    </html>
  `)
})

app.use('/common/', express.static('./../common/'))
app.use('/', (req, res, next) => {
  if (req.path === '/') {
    res.send(`
      <html><head><style>
      html,body {margin: 0; overflow: hidden;}
      html, body, #main { background: #222 }
      </style></head><body>
      <a href="/g/${Util.uniqId()}">New game :P</a>
      ${Object.keys(games).map(k => {
        return `<a href="/g/${k}">Game ${k}</a>`
      })}
      </body>
      </html>
    `)
  } else {
    statics(req, res, next)
  }
})

const wss = new WebSocketServer(config.ws);

const notify = (data, sockets) => {
  // TODO: throttle
  for (let socket of sockets) {
    wss.notifyOne(data, socket)
  }
  // console.log('notify', data)
}

wss.on('message', async ({socket, data}) => {
  try {
    const proto = socket.protocol.split('|')
    const playerId = proto[0]
    const gameId = proto[1]
    const [type, typeData] = JSON.parse(data)
    switch (type) {
      case EV_CLIENT_INIT: {
        if (!Game.exists(gameId)) {
          await Game.createGame(gameId, TARGET_TILES, Util.choice(IMAGES))
        }
        Game.addPlayer(gameId, playerId)
        Game.addSocket(gameId, socket)

        wss.notifyOne([EV_SERVER_INIT, Game.get(gameId)], socket)
      } break;

      case EV_CLIENT_MOUSE: {
        const changes = Game.handleInput(gameId, playerId, typeData)
        if (changes.length > 0) {
          notify([EV_SERVER_STATE_CHANGED, changes], Game.getSockets(gameId))
        }
      } break;
    }
  } catch (e) {
    console.error(e)
  }
})

app.listen(port, hostname, () => console.log(`server running on http://${hostname}:${port}`))
wss.listen()
