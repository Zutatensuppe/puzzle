import WebSocketServer from './WebSocketServer.js'

import fs from 'fs'
import express from 'express'
import multer from 'multer'
import config from './../config.js'
import Protocol from './../common/Protocol.js'
import Util, { logger } from './../common/Util.js'
import Game from './Game.js'
import twing from 'twing'
import bodyParser from 'body-parser'
import v8 from 'v8'
import GameLog from './GameLog.js'
import GameSockets from './GameSockets.js'
import Time from '../common/Time.js'
import exif from 'exif'
import sharp from 'sharp'

const log = logger('index.js')

async function getExifOrientation(imagePath) {
  return new Promise((resolve, reject) => {
    new exif.ExifImage({ image: imagePath }, function (error, exifData) {
      if (error) {
        resolve(0)

async function getExifOrientation(imagePath) {
  return new Promise((resolve, reject) => {
    new exif.ExifImage({ image: imagePath }, function (error, exifData) {
      if (error) {
        resolve(0)
      } else {
        resolve(exifData.image.Orientation)
      }
    })
  })
}
   } else {
        resolve(exifData.image.Orientation)
      }
    })
  })
}

const resizeImage = async (filename) => {
  const dir = `./../data/uploads/`
  if (!filename.match(/\.(jpe?g|webp|png)$/)) {
    return
  }
  console.log(filename)

  const imagePath = `${dir}/${filename}`
  const iamgeOutPath = `${dir}/r/${filename}`
  const orientation = await getExifOrientation(imagePath)

  let sharpImg = sharp(imagePath)
  // when image is rotated to the left or right, switch width/height
  // https://jdhao.github.io/2019/07/31/image_rotation_exif_info/
  if (orientation === 6) {
    sharpImg = sharpImg.rotate()
  } else if (orientation === 3) {
    sharpImg = sharpImg.rotate().rotate()
  } else if (orientation === 8) {
    sharpImg = sharpImg.rotate().rotate().rotate()
  }
  const sizes = [
    [150, 100],
    [375, 210],
  ]
  sizes.forEach(([w, h]) => {
    sharpImg.resize(w, h, {fit: 'contain'}).toFile(`${iamgeOutPath}-${w}x${h}.webp`)
  })
}

const allImages = () => {
  const images = fs.readdirSync('./../data/uploads/')
    .filter(f => f.match(/\.(jpe?g|webp|png)$/))
    .map(f => ({
      file: `./../data/uploads/${f}`,
      url: `/uploads/${f}`,
    }))
    .sort((a, b) => {
      return fs.statSync(b.file).mtime.getTime() -
        fs.statSync(a.file).mtime.getTime()
    })
  return images
}

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
  upload(req, res, async (err) => {
    if (err) {
      log.log(err)
      res.status(400).send("Something went wrong!");
    }

    try {
      await resizeImage(req.file.filename)
    } catch (err) {
      log.log(err)
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
  log.log(req.body.tiles, req.body.image)
  const gameId = Util.uniqId()
  if (!Game.exists(gameId)) {
    const ts = Time.timestamp()
    await Game.createGame(gameId, req.body.tiles, req.body.image, ts)
  }
  res.send({ url: `/g/${gameId}` })
})

app.use('/common/', express.static('./../common/'))
app.use('/uploads/', express.static('./../data/uploads/'))
app.use('/', async (req, res, next) => {
  if (req.path === '/') {
    const ts = Time.timestamp()
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
      gamesRunning: games.filter(g => !g.finished),
      gamesFinished: games.filter(g => !!g.finished),
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
    log.error(e)
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
        if (!GameLog.exists(gameId)) {
          throw `[gamelog ${gameId} does not exist... ]`
        }
        const log = GameLog.get(gameId)
        let game = await Game.createGameObject(
          gameId,
          log[0][2],
          log[0][3],
          log[0][4]
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

Game.loadAllGames()
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
  Game.persistChangedGames()

  memoryUsageHuman()
}, config.persistence.interval)

const gracefulShutdown = (signal) => {
  log.log(`${signal} received...`)

  log.log('clearing persist interval...')
  clearInterval(persistInterval)

  log.log('persisting games...')
  Game.persistChangedGames()

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
