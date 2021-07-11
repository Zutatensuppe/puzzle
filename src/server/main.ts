import WebSocketServer from './WebSocketServer'
import WebSocket from 'ws'
import express from 'express'
import compression from 'compression'
import multer from 'multer'
import Protocol from './../common/Protocol'
import Util, { logger } from './../common/Util'
import Game from './Game'
import v8 from 'v8'
import fs from 'fs'
import GameLog from './GameLog'
import GameSockets from './GameSockets'
import Time from './../common/Time'
import Images from './Images'
import {
  DB_FILE,
  DB_PATCHES_DIR,
  PUBLIC_DIR,
  UPLOAD_DIR,
} from './Dirs'
import GameCommon from '../common/GameCommon'
import { ServerEvent, Game as GameType, GameSettings } from '../common/Types'
import GameStorage from './GameStorage'
import Db from './Db'

const db = new Db(DB_FILE, DB_PATCHES_DIR)
db.patch()

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

app.use(compression())

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: function (req, file, cb) {
    cb(null , `${Util.uniqId()}-${file.originalname}`);
  }
})
const upload = multer({storage}).single('file');

app.get('/api/me', (req, res): void => {
  let user = getUser(db, req)
  res.send({
    id: user ? user.id : null,
    created: user ? user.created : null,
  })
})

app.get('/api/conf', (req, res): void => {
  res.send({
    WS_ADDRESS: config.ws.connectstring,
  })
})

app.get('/api/replay-data', async (req, res): Promise<void> => {
  const q: Record<string, any> = req.query
  const offset = parseInt(q.offset, 10) || 0
  if (offset < 0) {
    res.status(400).send({ reason: 'bad offset' })
    return
  }
  const size = parseInt(q.size, 10) || 10000
  if (size < 0 || size > 10000) {
    res.status(400).send({ reason: 'bad size' })
    return
  }
  const gameId = q.gameId || ''
  if (!GameLog.exists(q.gameId)) {
    res.status(404).send({ reason: 'no log found' })
    return
  }
  const log = GameLog.get(gameId, offset)
  let game: GameType|null = null
  if (offset === 0) {
    // also need the game
    game = await Game.createGameObject(
      gameId,
      log[0][2],
      log[0][3], // must be ImageInfo
      log[0][4],
      log[0][5],
      log[0][6],
      log[0][7],
      log[0][8], // creatorUserId
    )
  }
  res.send({ log, game: game ? Util.encodeGame(game) : null })
})

app.get('/api/newgame-data', (req, res): void => {
  const q: Record<string, any> = req.query
  const tagSlugs: string[] = q.tags ? q.tags.split(',') : []
  res.send({
    images: Images.allImagesFromDb(db, tagSlugs, q.sort),
    tags: Images.getAllTags(db),
  })
})

app.get('/api/index-data', (req, res): void => {
  const ts = Time.timestamp()
  const games = [
    ...GameCommon.getAllGames().map((game: GameType) => ({
      id: game.id,
      hasReplay: GameLog.exists(game.id),
      started: GameCommon.getStartTs(game.id),
      finished: GameCommon.getFinishTs(game.id),
      tilesFinished: GameCommon.getFinishedPiecesCount(game.id),
      tilesTotal: GameCommon.getPieceCount(game.id),
      players: GameCommon.getActivePlayers(game.id, ts).length,
      imageUrl: GameCommon.getImageUrl(game.id),
    })),
  ]

  res.send({
    gamesRunning: games.filter(g => !g.finished),
    gamesFinished: games.filter(g => !!g.finished),
  })
})

interface SaveImageRequestData {
  id: number
  title: string
  tags: string[]
}

const getOrCreateUser = (db: Db, req: any): any => {
  let user = getUser(db, req)
  if (!user) {
    db.insert('users', {
      'client_id': req.headers['client-id'],
      'client_secret': req.headers['client-secret'],
      'created': Time.timestamp(),
    })
    user = getUser(db, req)
  }
  return user
}

const getUser = (db: Db, req: any): any => {
  let user = db.get('users', {
    'client_id': req.headers['client-id'],
    'client_secret': req.headers['client-secret'],
  })
  if (user) {
    user.id = parseInt(user.id, 10)
  }
  return user
}

const setImageTags = (db: Db, imageId: number, tags: string[]): void => {
  tags.forEach((tag: string) => {
    const slug = Util.slug(tag)
    const id = db.upsert('categories', { slug, title: tag }, { slug }, 'id')
    if (id) {
      db.insert('image_x_category', {
        image_id: imageId,
        category_id: id,
      })
    }
  })
}

app.post('/api/save-image', express.json(), (req, res): void => {
  let user = getUser(db, req)
  if (!user || !user.id) {
    res.status(403).send({ ok: false, error: 'forbidden' })
    return
  }

  const data = req.body as SaveImageRequestData
  let image = db.get('images', {id: data.id})
  if (parseInt(image.uploader_user_id, 10) !== user.id) {
    res.status(403).send({ ok: false, error: 'forbidden' })
    return
  }

  db.update('images', {
    title: data.title,
  }, {
    id: data.id,
  })

  db.delete('image_x_category', { image_id: data.id })

  if (data.tags) {
    setImageTags(db, data.id, data.tags)
  }

  res.send({ ok: true })
})
app.post('/api/upload', (req, res): void => {
  upload(req, res, async (err: any): Promise<void> => {
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

    const user = getOrCreateUser(db, req)

    const dim = await Images.getDimensions(
      `${UPLOAD_DIR}/${req.file.filename}`
    )
    const imageId = db.insert('images', {
      uploader_user_id: user.id,
      filename: req.file.filename,
      filename_original: req.file.originalname,
      title: req.body.title || '',
      created: Time.timestamp(),
      width: dim.w,
      height: dim.h,
    })

    if (req.body.tags) {
      const tags = req.body.tags.split(',').filter((tag: string) => !!tag)
      setImageTags(db, imageId as number, tags)
    }

    res.send(Images.imageFromDb(db, imageId as number))
  })
})

app.post('/api/newgame', express.json(), async (req, res): Promise<void> => {
  let user = getOrCreateUser(db, req)
  if (!user || !user.id) {
    res.status(403).send({ ok: false, error: 'forbidden' })
    return
  }

  const gameSettings = req.body as GameSettings
  log.log(gameSettings)
  const gameId = Util.uniqId()
  if (!GameCommon.exists(gameId)) {
    const ts = Time.timestamp()
    await Game.createGame(
      gameId,
      gameSettings.tiles,
      gameSettings.image,
      ts,
      gameSettings.scoreMode,
      gameSettings.shapeMode,
      gameSettings.snapMode,
      user.id,
    )
  }
  res.send({ id: gameId })
})

app.use('/uploads/', express.static(UPLOAD_DIR))
app.use('/', express.static(PUBLIC_DIR))

const wss = new WebSocketServer(config.ws);

const notify = (data: ServerEvent, sockets: Array<WebSocket>): void => {
  for (const socket of sockets) {
    wss.notifyOne(data, socket)
  }
}

wss.on('close', async (
  {socket} : { socket: WebSocket }
): Promise<void> => {
  try {
    const proto = socket.protocol.split('|')
    // const clientId = proto[0]
    const gameId = proto[1]
    GameSockets.removeSocket(gameId, socket)
  } catch (e) {
    log.error(e)
  }
})

wss.on('message', async (
  {socket, data} : { socket: WebSocket, data: WebSocket.Data }
): Promise<void> => {
  try {
    const proto = socket.protocol.split('|')
    const clientId = proto[0]
    const gameId = proto[1]
    // TODO: maybe handle different types of data
    // (but atm only string comes through)
    const msg = JSON.parse(data as string)
    const msgType = msg[0]
    switch (msgType) {
      case Protocol.EV_CLIENT_INIT: {
        if (!GameCommon.exists(gameId)) {
          throw `[game ${gameId} does not exist... ]`
        }
        const ts = Time.timestamp()
        Game.addPlayer(gameId, clientId, ts)
        GameSockets.addSocket(gameId, socket)

        const game: GameType|null = GameCommon.get(gameId)
        if (!game) {
          throw `[game ${gameId} does not exist (anymore)... ]`
        }
        notify(
          [Protocol.EV_SERVER_INIT, Util.encodeGame(game)],
          [socket]
        )
      } break

      case Protocol.EV_CLIENT_EVENT: {
        if (!GameCommon.exists(gameId)) {
          throw `[game ${gameId} does not exist... ]`
        }
        const clientSeq = msg[1]
        const clientEvtData = msg[2]
        const ts = Time.timestamp()

        let sendGame = false
        if (!GameCommon.playerExists(gameId, clientId)) {
          Game.addPlayer(gameId, clientId, ts)
          sendGame = true
        }
        if (!GameSockets.socketExists(gameId, socket)) {
          GameSockets.addSocket(gameId, socket)
          sendGame = true
        }
        if (sendGame) {
          const game: GameType|null = GameCommon.get(gameId)
          if (!game) {
            throw `[game ${gameId} does not exist (anymore)... ]`
          }
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

GameStorage.loadGamesFromDb(db)
const server = app.listen(
  port,
  hostname,
  () => log.log(`server running on http://${hostname}:${port}`)
)
wss.listen()


const memoryUsageHuman = (): void => {
  const totalHeapSize = v8.getHeapStatistics().total_available_size
  const totalHeapSizeInGB = (totalHeapSize / 1024 / 1024 / 1024).toFixed(2)

  log.log(`Total heap size (bytes) ${totalHeapSize}, (GB ~${totalHeapSizeInGB})`)
  const used = process.memoryUsage().heapUsed / 1024 / 1024
  log.log(`Mem: ${Math.round(used * 100) / 100}M`)
}

memoryUsageHuman()

// persist games in fixed interval
const persistInterval = setInterval(() => {
  log.log('Persisting games...')
  GameStorage.persistGamesToDb(db)

  memoryUsageHuman()
}, config.persistence.interval)

const gracefulShutdown = (signal: string): void => {
  log.log(`${signal} received...`)

  log.log('clearing persist interval...')
  clearInterval(persistInterval)

  log.log('persisting games...')
  GameStorage.persistGamesToDb(db)

  log.log('shutting down webserver...')
  server.close()

  log.log('shutting down websocketserver...')
  wss.close()

  log.log('shutting down...')
  process.exit()
}

// used by nodemon
process.once('SIGUSR2', (): void => {
  gracefulShutdown('SIGUSR2')
})

process.once('SIGINT', (): void => {
  gracefulShutdown('SIGINT')
})

process.once('SIGTERM', (): void => {
  gracefulShutdown('SIGTERM')
})
