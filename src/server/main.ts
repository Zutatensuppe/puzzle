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
import Users from './Users'

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
  let user = Users.getUser(db, req)
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
      log[0][1], // gameVersion
      log[0][2], // targetTiles
      log[0][3], // must be ImageInfo
      log[0][4], // ts (of game creation)
      log[0][5], // scoreMode
      log[0][6], // shapeMode
      log[0][7], // snapMode
      log[0][8], // creatorUserId
      true,      // hasReplay
      !!log[0][9], // private
    )
  }
  res.send({ log, game: game ? Util.encodeGame(game) : null })
})

app.get('/api/newgame-data', (req, res): void => {
  const q: Record<string, any> = req.query
  const tagSlugs: string[] = q.tags ? q.tags.split(',') : []
  res.send({
    images: Images.allImagesFromDb(db, tagSlugs, q.sort, false),
    tags: Images.getAllTags(db),
  })
})

app.get('/api/index-data', (req, res): void => {
  const ts = Time.timestamp()
  const games = [
    ...GameStorage.getAllPublicGames(db).map((game: GameType) => ({
      id: game.id,
      hasReplay: GameLog.hasReplay(game),
      started: GameCommon.Game_getStartTs(game),
      finished: GameCommon.Game_getFinishTs(game),
      tilesFinished: GameCommon.Game_getFinishedPiecesCount(game),
      tilesTotal: GameCommon.Game_getPieceCount(game),
      players: GameCommon.Game_getActivePlayers(game, ts).length,
      imageUrl: GameCommon.Game_getImageUrl(game),
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

app.post('/api/save-image', express.json(), (req, res): void => {
  const user = Users.getUser(db, req)
  if (!user || !user.id) {
    res.status(403).send({ ok: false, error: 'forbidden' })
    return
  }

  const data = req.body as SaveImageRequestData
  const image = db.get('images', {id: data.id})
  if (parseInt(image.uploader_user_id, 10) !== user.id) {
    res.status(403).send({ ok: false, error: 'forbidden' })
    return
  }

  db.update('images', {
    title: data.title,
  }, {
    id: data.id,
  })

  Images.setTags(db, data.id, data.tags || [])

  res.send({ ok: true })
})
app.post('/api/upload', (req: any, res): void => {
  upload(req, res, async (err: any): Promise<void> => {
    if (err) {
      log.log(err)
      res.status(400).send("Something went wrong!")
      return
    }

    try {
      await Images.resizeImage(req.file.filename)
    } catch (err) {
      log.log(err)
      res.status(400).send("Something went wrong!")
      return
    }

    const user = Users.getOrCreateUser(db, req)

    const dim = await Images.getDimensions(
      `${UPLOAD_DIR}/${req.file.filename}`
    )
    // post form, so booleans are submitted as 'true' | 'false'
    const isPrivate = req.body.private === 'false' ? 0 : 1;
    const imageId = db.insert('images', {
      uploader_user_id: user.id,
      filename: req.file.filename,
      filename_original: req.file.originalname,
      title: req.body.title || '',
      created: Time.timestamp(),
      width: dim.w,
      height: dim.h,
      private: isPrivate,
    })
    console.log(imageId)

    if (req.body.tags) {
      const tags = req.body.tags.split(',').filter((tag: string) => !!tag)
      Images.setTags(db, imageId as number, tags)
    }

    res.send(Images.imageFromDb(db, imageId as number))
  })
})

app.post('/api/newgame', express.json(), async (req, res): Promise<void> => {
  const user = Users.getOrCreateUser(db, req)
  const gameId = await Game.createNewGame(
    db,
    req.body as GameSettings,
    Time.timestamp(),
    user.id
  )
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

const persistGame = (gameId: string): void => {
  const game: GameType|null = GameCommon.get(gameId)
  if (!game) {
    log.error(`[ERROR] unable to persist non existing game ${gameId}`)
    return
  }
  GameStorage.persistGame(db, game)
}

const persistGames = (): void => {
  for (const gameId of GameStorage.dirtyGameIds()) {
    persistGame(gameId)
  }
}

wss.on('close', async (
  {socket} : { socket: WebSocket }
): Promise<void> => {
  try {
    const proto = socket.protocol.split('|')
    const clientId = proto[0]
    const gameId = proto[1]
    GameSockets.removeSocket(gameId, socket)

    const ts = Time.timestamp()
    const clientSeq = -1 // client lost connection, so clientSeq doesn't matter
    const clientEvtData = [ Protocol.INPUT_EV_CONNECTION_CLOSE ]
    const changes = Game.handleInput(gameId, clientId, clientEvtData, ts)
    const sockets = GameSockets.getSockets(gameId)
    if (sockets.length) {
      notify(
        [Protocol.EV_SERVER_EVENT, clientId, clientSeq, changes],
        sockets
      )
    } else {
      persistGame(gameId)
      log.info(`[INFO] unloading game: ${gameId}`);
      GameCommon.unsetGame(gameId)
    }

  } catch (e) {
    log.error(e)
  }
})

wss.on('message', async (
  {socket, data} : { socket: WebSocket, data: WebSocket.Data }
): Promise<void> => {
  if (!data) {
    // no data (maybe ping :3)
    return;
  }
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
        if (!GameCommon.loaded(gameId)) {
          const gameObject = GameStorage.loadGame(db, gameId)
          if (!gameObject) {
            throw `[game ${gameId} does not exist... ]`
          }
          GameCommon.setGame(gameObject.id, gameObject)
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
        if (!GameCommon.loaded(gameId)) {
          const gameObject = GameStorage.loadGame(db, gameId)
          if (!gameObject) {
            throw `[game ${gameId} does not exist... ]`
          }
          GameCommon.setGame(gameObject.id, gameObject)
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
    log.error('data:', data)
  }
})

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
  persistGames()
  memoryUsageHuman()
}, config.persistence.interval)

const gracefulShutdown = (signal: string): void => {
  log.log(`${signal} received...`)

  log.log('clearing persist interval...')
  clearInterval(persistInterval)

  log.log('Persisting games...')
  persistGames()

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
