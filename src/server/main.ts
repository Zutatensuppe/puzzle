import WebSocketServer from './WebSocketServer'
import WebSocket from 'ws'
import express from 'express'
import compression from 'compression'
import Protocol from './../common/Protocol'
import Util, { logger } from './../common/Util'
import Game from './Game'
import v8 from 'v8'
import GameSockets from './GameSockets'
import Time from './../common/Time'
import config from './Config'
import GameCommon from '../common/GameCommon'
import { ServerEvent, Game as GameType } from '../common/Types'
import GameStorage from './GameStorage'
import Db from './Db'
import createApiRouter from './web_routes/api'

const run = async () => {
  const db = new Db(config.db.connectStr, config.dir.DB_PATCHES_DIR)
  await db.connect()
  await db.patch()

  const log = logger('main.js')

  const port = config.http.port
  const hostname = config.http.hostname
  const app = express()

  app.use(compression())

  app.use('/api', createApiRouter(db))
  app.use('/uploads/', express.static(config.dir.UPLOAD_DIR))
  app.use('/', express.static(config.dir.PUBLIC_DIR))

  const wss = new WebSocketServer(config.ws);

  const notify = (data: ServerEvent, sockets: Array<WebSocket>): void => {
    for (const socket of sockets) {
      wss.notifyOne(data, socket)
    }
  }

  const persistGame = async (gameId: string): Promise<void> => {
    const game: GameType|null = GameCommon.get(gameId)
    if (!game) {
      log.error(`[ERROR] unable to persist non existing game ${gameId}`)
      return
    }
    await GameStorage.persistGame(db, game)
  }

  const persistGames = async (): Promise<void> => {
    for (const gameId of GameStorage.dirtyGameIds()) {
      await persistGame(gameId)
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
    {socket, data} : { socket: WebSocket, data: string }
  ): Promise<void> => {
    if (!data) {
      // no data (maybe ping :3)
      return;
    }
    try {
      const proto = socket.protocol.split('|')
      const clientId = proto[0]
      const gameId = proto[1]
      const msg = JSON.parse(data)
      const msgType = msg[0]
      switch (msgType) {
        case Protocol.EV_CLIENT_INIT: {
          if (!GameCommon.loaded(gameId)) {
            const gameObject = await GameStorage.loadGame(db, gameId)
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
            const gameObject = await GameStorage.loadGame(db, gameId)
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
  let persistInterval: any = null
  const doPersist = async () => {
    log.log('Persisting games...')
    await persistGames()
    memoryUsageHuman()
    persistInterval = setTimeout(doPersist, config.persistence.interval)
  }
  persistInterval = setTimeout(doPersist, config.persistence.interval)

  const gracefulShutdown = async (signal: string): Promise<void> => {
    log.log(`${signal} received...`)

    log.log('clearing persist interval...')
    clearInterval(persistInterval)

    log.log('Persisting games...')
    await persistGames()

    log.log('shutting down webserver...')
    server.close()

    log.log('shutting down websocketserver...')
    wss.close()

    log.log('shutting down...')
    process.exit()
  }

  // used by nodemon
  process.once('SIGUSR2', async (): Promise<void> => {
    await gracefulShutdown('SIGUSR2')
  })

  process.once('SIGINT', async (): Promise<void> => {
    await gracefulShutdown('SIGINT')
  })

  process.once('SIGTERM', async (): Promise<void> => {
    await gracefulShutdown('SIGTERM')
  })
}

run()
