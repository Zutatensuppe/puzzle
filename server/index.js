import WebSocketServer from './WebSocketServer.js'

import fs from 'fs'
import express from 'express'
import multer from 'multer'
import config from './../config.js'
import Protocol from './../common/Protocol.js'
import Util from './../common/Util.js'
import Game from './Game.js'
import twing from 'twing'
import bodyParser from 'body-parser'
import v8 from 'v8'
import { Rng } from '../common/Rng.js'
import GameLog from './GameLog.js'
import GameSockets from './GameSockets.js'

const allImages = () => [
  ...fs.readdirSync('./../data/uploads/').map(f => ({
    file: `./../data/uploads/${f}`,
    url: `/uploads/${f}`,
  })),
  ...fs.readdirSync('./../game/example-images/').map(f => ({
    file: `./../game/example-images/${f}`,
    url: `/example-images/${f}`,
  })),
]

const port = config.http.port
const hostname = config.http.hostname
const app = express()

const uploadDir = './../data/uploads'
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: function (req, file, cb) {
    cb(null , file.originalname);
  }
})
const upload = multer({storage}).single('file');

const statics = express.static('./../game/')

const render = async (template, data) => {
  const loader = new twing.TwingLoaderFilesystem('./../game/templates')
  const env = new twing.TwingEnvironment(loader)
  return env.render(template, data)
}

app.use('/g/:gid', async (req, res, next) => {
  res.send(await render('game.html.twig', {
    GAME_ID: req.params.gid,
    WS_ADDRESS: config.ws.connectstring,
  }))
})

app.use('/replay/:gid', async (req, res, next) => {
  res.send(await render('replay.html.twig', {
    GAME_ID: req.params.gid,
    WS_ADDRESS: config.ws.connectstring,
  }))
})

app.post('/upload', (req, res) => {
  upload(req, res, (err) => {
    if (err) {
      console.log(err)
      res.status(400).send("Something went wrong!");
    }
    res.send({
      image: {
        file: './../data/uploads/' + req.file.filename,
        url: '/uploads/' + req.file.filename,
      },
    })
  })
})
app.post('/newgame', bodyParser.json(), async (req, res) => {
  console.log(req.body.tiles, req.body.image)
  const gameId = Util.uniqId()
  if (!Game.exists(gameId)) {
    const ts = Util.timestamp()
    await Game.createGame(gameId, req.body.tiles, req.body.image, ts)
  }
  res.send({ url: `/g/${gameId}` })
})

app.use('/common/', express.static('./../common/'))
app.use('/uploads/', express.static('./../data/uploads/'))
app.use('/', async (req, res, next) => {
  if (req.path === '/') {
    const ts = Util.timestamp()
    const games = [
      ...Game.getAllGames().map(game => ({
        id: game.id,
        hasReplay: GameLog.exists(game.id),
        started: Game.getStartTs(game.id),
        finished: Game.getFinishTs(game.id),
        tilesFinished: Game.getFinishedTileCount(game.id),
        tilesTotal: Game.getTileCount(game.id),
        players: Game.getActivePlayers(game.id, ts).length,
        imageUrl: Game.getImageUrl(game.id),
      })),
    ]

    res.send(await render('index.html.twig', {
      games,
      images: allImages(),
    }))
  } else {
    statics(req, res, next)
  }
})

const wss = new WebSocketServer(config.ws);

const notify = (data, sockets) => {
  // TODO: throttle?
  for (let socket of sockets) {
    wss.notifyOne(data, socket)
  }
}

wss.on('close', async ({socket}) => {
  try {
    const proto = socket.protocol.split('|')
    const clientId = proto[0]
    const gameId = proto[1]
    GameSockets.removeSocket(gameId, socket)
  } catch (e) {
    console.error(e)
  }
})

wss.on('message', async ({socket, data}) => {
  try {
    const proto = socket.protocol.split('|')
    const clientId = proto[0]
    const gameId = proto[1]
    const msg = JSON.parse(data)
    const msgType = msg[0]
    switch (msgType) {
      case Protocol.EV_CLIENT_INIT_REPLAY: {
        const log = GameLog.get(gameId)
        let game = await Game.createGameObject(
          gameId,
          log[0][2],
          log[0][3],
          log[0][4]
        )
        notify(
          [Protocol.EV_SERVER_INIT_REPLAY, {
            id: game.id,
            rng: {
              type: game.rng.type,
              obj: Rng.serialize(game.rng.obj),
            },
            puzzle: game.puzzle,
            players: game.players,
            evtInfos: game.evtInfos,
          }, log],
          [socket]
        )
      } break;

      case Protocol.EV_CLIENT_INIT: {
        if (!Game.exists(gameId)) {
          throw `[game ${gameId} does not exist... ]`
        }
        const ts = Util.timestamp()
        Game.addPlayer(gameId, clientId, ts)
        GameSockets.addSocket(gameId, socket)
        const game = Game.get(gameId)
        notify(
          [Protocol.EV_SERVER_INIT, {
            id: game.id,
            rng: {
              type: game.rng.type,
              obj: Rng.serialize(game.rng.obj),
            },
            puzzle: game.puzzle,
            players: game.players,
            evtInfos: game.evtInfos,
          }],
          [socket]
        )
      } break;

      case Protocol.EV_CLIENT_EVENT: {
        const clientSeq = msg[1]
        const clientEvtData = msg[2]
        const ts = Util.timestamp()

        Game.addPlayer(gameId, clientId, ts)
        GameSockets.addSocket(gameId, socket)

        const game = Game.get(gameId)
        notify(
          [Protocol.EV_SERVER_INIT, {
            id: game.id,
            puzzle: game.puzzle,
            players: game.players,
            evtInfos: game.evtInfos,
          }],
          [socket]
        )
        const changes = Game.handleInput(gameId, clientId, clientEvtData, ts)
        notify(
          [Protocol.EV_SERVER_EVENT, clientId, clientSeq, changes],
          GameSockets.getSockets(gameId)
        )
      } break;
    }
  } catch (e) {
    console.error(e)
  }
})

Game.loadAllGames()
const server = app.listen(
  port,
  hostname,
  () => console.log(`server running on http://${hostname}:${port}`)
)
wss.listen()


const memoryUsageHuman = () => {
  const totalHeapSize = v8.getHeapStatistics().total_available_size
  let totalHeapSizeInGB = (totalHeapSize / 1024 / 1024 / 1024).toFixed(2)

  console.log(`Total heap size (bytes) ${totalHeapSize}, (GB ~${totalHeapSizeInGB})`)
  const used = process.memoryUsage().heapUsed / 1024 / 1024
  console.log(`Mem: ${Math.round(used * 100) / 100}M`)
}

memoryUsageHuman()

// persist games in fixed interval
const persistInterval = setInterval(() => {
  console.log('Persisting games...');
  Game.persistChangedGames()

  memoryUsageHuman()
}, config.persistence.interval)

const gracefulShutdown = (signal) => {
  console.log(`${signal} received...`)

  console.log('clearing persist interval...')
  clearInterval(persistInterval)

  console.log('persisting games...')
  Game.persistChangedGames()

  console.log('shutting down webserver...')
  server.close()

  console.log('shutting down websocketserver...')
  wss.close()

  console.log('shutting down...')
  process.exit()
}

// used by nodemon
process.once('SIGUSR2', function () {
  gracefulShutdown('SIGUSR2')
});

process.once('SIGINT', function (code) {
  gracefulShutdown('SIGINT')
});

process.once('SIGTERM', function (code) {
  gracefulShutdown('SIGTERM')
});
