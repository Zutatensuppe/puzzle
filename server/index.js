import WebSocketServer from './WebSocketServer.js'

import express from 'express'

import config from './config.js'

const port = config.http.port
const hostname = config.http.hostname
const app = express()
const statics = express.static('./../game/')
app.use('/', (req, res, next) => {
  if (req.path === '/') {
    res.send(`
      <html><head><style>
      html,body {margin: 0; overflow: hidden;}
      html, body, #main { background: #222 }
      </style></head><body>
      <script>window.WS_ADDRESS = '${config.ws.connectstring}'</script>
      <script src="index.js" type="module"></script>
      </body>
      </html>
    `)
  } else {
    statics(req, res, next)
  }
})
app.listen(port, hostname, () => console.log(`server running on http://${hostname}:${port}`))

const games = {}

const wss = new WebSocketServer(config.ws);

const notify = (data) => {
  // TODO: throttle
  wss.notifyAll(data)
  console.log('notify', data)
}

wss.on('message', ({socket, data}) => {
  try {
    const proto = socket.protocol.split('|')
    const uid = proto[0]
    const gid = proto[1]
    const parsed = JSON.parse(data)
    switch (parsed.type) {
      case 'init': {
        // a new player (or previous player) joined
        games[gid] = games[gid] || {puzzle: null, players: {}}

        games[gid].players[uid] = parsed.player

        wss.notifyOne({
          type: 'init',
          puzzle: games[gid].puzzle,
          players: games[gid].players,
        }, socket)
      } break;

      // new puzzle was created and sent to us
      case 'init_puzzle': {
        games[gid].puzzle = parsed.puzzle
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
        notify({type:'state_changed', origin: uid, changes: parsed.state.changes})
      } break;
    }
  } catch (e) {
    console.error(e)
  }
})
wss.listen()
