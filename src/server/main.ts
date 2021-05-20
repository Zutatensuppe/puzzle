import WebSocketServer from './WebSocketServer'
import WebSocket from 'ws'
import express from 'express'
import multer from 'multer'
import Protocol from './../common/Protocol'
import Util, { logger } from './../common/Util'
import Game from './Game'
import bodyParser from 'body-parser'
import v8 from 'v8'
import fs from 'fs'
import GameLog from './GameLog'
import GameSockets from './GameSockets'
import Time from './../common/Time'
import Images from './Images'
import { UPLOAD_DIR, UPLOAD_URL, PUBLIC_DIR } from './Dirs'
import GameCommon, { ScoreMode } from '../common/GameCommon'
import GameStorage from './GameStorage'

let configFile = ''
let last = ''
for (const val of process.argv) {
  if (last === '-c') {
    configFile = val
  }
  last = val
}

if (configFile === '') {
  process.exit(2)
}

const config = JSON.parse(String(fs.readFileSync(configFile)))

const log = logger('main.js')

const port = config.http.port
const hostname = config.http.hostname
const app = express()

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: function (req, file, cb) {
    cb(null , `${Util.uniqId()}-${file.originalname}`);
  }
})
const upload = multer({storage}).single('file');

app.get('/api/conf', (req, res) => {
  res.send({
    WS_ADDRESS: config.ws.connectstring,
  })
})

app.get('/api/newgame-data', (req, res) => {
  res.send({
    images: Images.allImages(),
  })
})

app.get('/api/index-data', (req, res) => {
  const ts = Time.timestamp()
  const games = [
    ...Game.getAllGames().map((game: any) => ({
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

  res.send({
    gamesRunning: games.filter(g => !g.finished),
    gamesFinished: games.filter(g => !!g.finished),
  })
})

app.post('/upload', (req, res) => {
  upload(req, res, async (err: any) => {
    if (err) {
      log.log(err)
      res.status(400).send("Something went wrong!");
    }

    try {
      await Images.resizeImage(req.file.filename)
    } catch (err) {
      log.log(err)
      res.status(400).send("Something went wrong!");
    }

    res.send({
      image: {
        file: `${UPLOAD_DIR}/${req.file.filename}`,
        url: `${UPLOAD_URL}/${req.file.filename}`,
      },
    })
  })
})

app.post('/newgame', bodyParser.json(), async (req, res) => {
  log.log(req.body.tiles, req.body.image)
  const gameId = Util.uniqId()
  if (!Game.exists(gameId)) {
    const ts = Time.timestamp()
    await Game.createGame(
      gameId,
      req.body.tiles,
      req.body.image,
      ts,
      req.body.scoreMode
    )
  }
  res.send({ id: gameId })
})

app.use('/uploads/', express.static(UPLOAD_DIR))
app.use('/', express.static(PUBLIC_DIR))

const wss = new WebSocketServer(config.ws);

const notify = (data: any, sockets: Array<WebSocket>) => {
  // TODO: throttle?
  for (let socket of sockets) {
    wss.notifyOne(data, socket)
  }
}

wss.on('close', async ({socket} : {socket: WebSocket}) => {
  try {
    const proto = socket.protocol.split('|')
    const clientId = proto[0]
    const gameId = proto[1]
    GameSockets.removeSocket(gameId, socket)
  } catch (e) {
    log.error(e)
  }
})

wss.on('message', async ({socket, data} : { socket: WebSocket, data: any }) => {
  try {
    const proto = socket.protocol.split('|')
    const clientId = proto[0]
    const gameId = proto[1]
    const msg = JSON.parse(data)
    const msgType = msg[0]
    switch (msgType) {
      case Protocol.EV_CLIENT_INIT_REPLAY: {
        if (!GameLog.exists(gameId)) {
          throw `[gamelog ${gameId} does not exist... ]`
        }
        const log = GameLog.get(gameId)
        const game = await Game.createGameObject(
          gameId,
          log[0][2],
          log[0][3],
          log[0][4],
          log[0][5] || ScoreMode.FINAL
        )
        notify(
          [Protocol.EV_SERVER_INIT_REPLAY, Util.encodeGame(game), log],
          [socket]
        )
      } break

      case Protocol.EV_CLIENT_INIT: {
        if (!Game.exists(gameId)) {
          throw `[game ${gameId} does not exist... ]`
        }
        const ts = Time.timestamp()
        Game.addPlayer(gameId, clientId, ts)
        GameSockets.addSocket(gameId, socket)
        const game = Game.get(gameId)
        notify(
          [Protocol.EV_SERVER_INIT, Util.encodeGame(game)],
          [socket]
        )
      } break

      case Protocol.EV_CLIENT_EVENT: {
        if (!Game.exists(gameId)) {
          throw `[game ${gameId} does not exist... ]`
        }
        const clientSeq = msg[1]
        const clientEvtData = msg[2]
        const ts = Time.timestamp()

        let sendGame = false
        if (!Game.playerExists(gameId, clientId)) {
          Game.addPlayer(gameId, clientId, ts)
          sendGame = true
        }
        if (!GameSockets.socketExists(gameId, socket)) {
          GameSockets.addSocket(gameId, socket)
          sendGame = true
        }
        if (sendGame) {
          const game = Game.get(gameId)
          notify(
            [Protocol.EV_SERVER_INIT, Util.encodeGame(game)],
            [socket]
          )
        }

        const changes = Game.handleInput(gameId, clientId, clientEvtData, ts)
        notify(
          [Protocol.EV_SERVER_EVENT, clientId, clientSeq, changes],
          GameSockets.getSockets(gameId)
        )
      } break
    }
  } catch (e) {
    log.error(e)
  }
})

GameStorage.loadGames()
const server = app.listen(
  port,
  hostname,
  () => log.log(`server running on http://${hostname}:${port}`)
)
wss.listen()


const memoryUsageHuman = () => {
  const totalHeapSize = v8.getHeapStatistics().total_available_size
  let totalHeapSizeInGB = (totalHeapSize / 1024 / 1024 / 1024).toFixed(2)

  log.log(`Total heap size (bytes) ${totalHeapSize}, (GB ~${totalHeapSizeInGB})`)
  const used = process.memoryUsage().heapUsed / 1024 / 1024
  log.log(`Mem: ${Math.round(used * 100) / 100}M`)
}

memoryUsageHuman()

// persist games in fixed interval
const persistInterval = setInterval(() => {
  log.log('Persisting games...')
  GameStorage.persistGames()

  memoryUsageHuman()
}, config.persistence.interval)

const gracefulShutdown = (signal: any) => {
  log.log(`${signal} received...`)

  log.log('clearing persist interval...')
  clearInterval(persistInterval)

  log.log('persisting games...')
  GameStorage.persistGames()

  log.log('shutting down webserver...')
  server.close()

  log.log('shutting down websocketserver...')
  wss.close()

  log.log('shutting down...')
  process.exit()
}

// used by nodemon
process.once('SIGUSR2', function () {
  gracefulShutdown('SIGUSR2')
})

process.once('SIGINT', function (code) {
  gracefulShutdown('SIGINT')
})

process.once('SIGTERM', function (code) {
  gracefulShutdown('SIGTERM')
})
