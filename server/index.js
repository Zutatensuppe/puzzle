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

const allImages = () => [
  ...fs.readdirSync('./../game/example-images/').map(f => ({
    file: `./../game/example-images/${f}`,
    url: `/example-images/${f}`,
  })),
  ...fs.readdirSync('./../data/uploads/').map(f => ({
    file: `./../data/uploads/${f}`,
    url: `/uploads/${f}`,
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
    await Game.createGame(gameId, req.body.tiles, req.body.image)
  }
  res.send({ url: `/g/${gameId}` })
})

app.use('/common/', express.static('./../common/'))
app.use('/uploads/', express.static('./../data/uploads/'))
app.use('/', async (req, res, next) => {
  if (req.path === '/') {
    const games = [
      ...Game.getAllGames().map(game => ({
        id: game.id,
        started: Game.getStartTs(game.id),
        finished: Game.getFinishTs(game.id),
        tilesFinished: Game.getFinishedTileCount(game.id),
        tilesTotal: Game.getTileCount(game.id),
        players: Game.getActivePlayers(game.id).length,
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
  const proto = socket.protocol.split('|')
  const clientId = proto[0]
  const gameId = proto[1]
  if (Game.exists(gameId)) {
    Game.removeSocket(gameId, socket)
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
      case Protocol.EV_CLIENT_INIT: {
        if (!Game.exists(gameId)) {
          throw `[game ${gameId} does not exist... ]`
        }
        Game.addPlayer(gameId, clientId)
        Game.addSocket(gameId, socket)
        const game = Game.get(gameId)
        notify(
          [Protocol.EV_SERVER_INIT, {
            id: game.id,
            puzzle: game.puzzle,
            players: game.players,
            sockets: [],
            evtInfos: game.evtInfos,
          }],
          [socket]
        )
      } break;

      case Protocol.EV_CLIENT_EVENT: {
        const clientSeq = msg[1]
        const clientEvtData = msg[2]
        Game.addPlayer(gameId, clientId)
        Game.addSocket(gameId, socket)

        const game = Game.get(gameId)
        notify(
          [Protocol.EV_SERVER_INIT, {
            id: game.id,
            puzzle: game.puzzle,
            players: game.players,
            sockets: [],
            evtInfos: game.evtInfos,
          }],
          [socket]
        )
        const changes = Game.handleInput(gameId, clientId, clientEvtData)
        notify(
          [Protocol.EV_SERVER_EVENT, clientId, clientSeq, changes],
          Game.getSockets(gameId)
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

// persist games in fixed interval
const persistInterval = setInterval(() => {
  console.log('Persisting games...');
  Game.persistAll()
}, config.persistence.interval)

const gracefulShutdown = (signal) => {
  console.log(`${signal} received...`)

  console.log('clearing persist interval...')
  clearInterval(persistInterval)

  console.log('persisting games...')
  Game.persistAll()

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
