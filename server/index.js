import WebSocketServer from './WebSocketServer.js'

import express from 'express'
import { createPuzzle } from './puzzle.js'
import config from './config.js'
import { uniqId, choice } from './util.js'

// desired number of tiles
// actual calculated number can be higher
const TARGET_TILES = 500

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

app.use('/', (req, res, next) => {
  if (req.path === '/') {
    res.send(`
      <html><head><style>
      html,body {margin: 0; overflow: hidden;}
      html, body, #main { background: #222 }
      </style></head><body>
      <a href="/g/${uniqId()}">New game :P</a>
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
  console.log('notify', data)
}

wss.on('message', async ({socket, data}) => {
  try {
    const proto = socket.protocol.split('|')
    const uid = proto[0]
    const gid = proto[1]
    const parsed = JSON.parse(data)
    switch (parsed.type) {
      case 'init': {
        // a new player (or previous player) joined
        games[gid] = games[gid] || {
          puzzle: await createPuzzle(TARGET_TILES, choice(IMAGES)),
          players: {},
          sockets: []
        }
        if (!games[gid].sockets.includes(socket)) {
          games[gid].sockets.push(socket)
        }
        games[gid].players[uid] = {id: uid, x: 0, y: 0, down: false}

        wss.notifyOne({
          type: 'init',
          game: {
            puzzle: games[gid].puzzle,
            players: games[gid].players,
          },
        }, socket)
      } break;

      // somebody has changed the state
      case 'state': {
        for (let change of parsed.state.changes) {
          switch (change.type) {
            case 'change_player': {
              games[gid].players[uid] = change.player
            } break;
            case 'change_tile': {
              games[gid].puzzle.tiles[change.tile.idx] = change.tile
            } break;
            case 'change_data': {
              games[gid].puzzle.data = change.data
            } break;
          }
        }
        notify({
          type:'state_changed',
          origin: uid,
          changes: parsed.state.changes,
        }, games[gid].sockets)
      } break;
    }
  } catch (e) {
    console.error(e)
  }
})

app.listen(port, hostname, () => console.log(`server running on http://${hostname}:${port}`))
wss.listen()
