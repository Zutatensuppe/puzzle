import WebSocketServer from './WebSocketServer.js'

import express from 'express'

const httpConfig = {
  hostname: 'localhost',
  port: 1337,
}
const port = httpConfig.port
const hostname = httpConfig.hostname
const app = express()
app.use('/', express.static('./../game/'))
app.listen(port, hostname, () => console.log(`server running on ${hostname}:${port}`))


const players = {

}
const games = {}


const wssConfig = {
  hostname: 'localhost',
  port: 1338,
  connectstring: `ws://localhost:1338/ws`,
}
const wss = new WebSocketServer(wssConfig);


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
