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


const players = {

}
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
        players[uid] = players[uid] || {}
        players[uid].id = uid
        players[uid].tiles = players[uid].tiles || 0
        players[uid].m_x = players[uid].x || null
        players[uid].m_y = players[uid].y || null
        players[uid].m_d = false
        console.log('init', players)
        const puzzle = games[gid] ? games[gid].puzzle : null
        console.log('init', games[gid])
        wss.notifyOne({type: 'init', puzzle: puzzle}, socket)
      } break;

      case 'init_puzzle': {
        games[gid] = {
          puzzle: parsed.puzzle,
        }
      } break;

      case 'state': {
        players[uid].m_x = parsed.state.m_x
        players[uid].m_y = parsed.state.m_y
        players[uid].m_d = parsed.state.m_d
      } break;

      case 'change_tile': {
        let idx = parsed.idx
        let z = parsed.z
        let finished = parsed.finished
        let pos = { x: parsed.pos.x, y: parsed.pos.y }
        let group = parsed.group
        // games[gid].puzzle.tiles[idx] = games[gid].puzzle.tiles[idx] || {}
        games[gid].puzzle.tiles[idx].pos = pos
        games[gid].puzzle.tiles[idx].z = z
        games[gid].puzzle.tiles[idx].finished = finished
        games[gid].puzzle.tiles[idx].group = group
        notify({type:'tile_changed', origin: uid, idx, pos, z, finished, group})
      } break;
    }
  } catch (e) {
    console.error(e)
  }
})
wss.listen()
