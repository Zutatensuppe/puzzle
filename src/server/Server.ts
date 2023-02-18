import WebSocketServer from './WebSocketServer'
import WebSocket from 'ws'
import express, { NextFunction } from 'express'
import compression from 'compression'
import Protocol from './../common/Protocol'
import Util, { logger } from './../common/Util'
import { GameSockets } from './GameSockets'
import Time from './../common/Time'
import config from './Config'
import GameCommon from '../common/GameCommon'
import { ServerEvent, Game as GameType } from '../common/Types'
import { GameService } from './GameService'
import createApiRouter from './web_routes/api'
import createAdminApiRouter from './web_routes/admin/api'
import createImageServiceRouter from './web_routes/image-service'
import cookieParser from 'cookie-parser'
import { Users } from './Users'
import Mail from './Mail'
import { Canny } from './Canny'
import { Discord } from './Discord'
import Db from './Db'
import { Server as HttpServer } from 'http';
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'
import { Images } from './Images'
import { TokensRepo } from './repo/TokensRepo'
import { AnnouncementsRepo } from './repo/AnnouncementsRepo'
import { ImageResize } from './ImageResize'
import { LeaderboardRepo } from './repo/LeaderboardRepo'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const indexFile = path.resolve(__dirname, '..', '..', 'build', 'public', 'index.html')

const log = logger('Server.ts')

export interface ServerInterface {
  getDb: () => Db
  getMail: () => Mail
  getCanny: () => Canny
  getDiscord: () => Discord
  getGameSockets: () => GameSockets
  getGameService: () => GameService
  getUsers: () => Users
  getImages: () => Images
  getImageResize: () => ImageResize
  getTokensRepo: () => TokensRepo
  getAnnouncementsRepo: () => AnnouncementsRepo
  getLeaderboardRepo: () => LeaderboardRepo
}

export class Server implements ServerInterface {
  private webserver: HttpServer | null = null
  private websocketserver: WebSocketServer | null = null

  constructor(
    private readonly db: Db,
    private readonly mail: Mail,
    private readonly canny: Canny,
    private readonly discord: Discord,
    private readonly gameSockets: GameSockets,
    private readonly gameService: GameService,
    private readonly users: Users,
    private readonly images: Images,
    private readonly imageResize: ImageResize,
    private readonly tokensRepo: TokensRepo,
    private readonly announcementsRepo: AnnouncementsRepo,
    private readonly leaderboardRepo: LeaderboardRepo,
  ) {
    // pass
  }

  getDb(): Db {
    return this.db
  }
  getMail(): Mail {
    return this.mail
  }
  getCanny(): Canny {
    return this.canny
  }
  getDiscord(): Discord {
    return this.discord
  }
  getGameSockets(): GameSockets {
    return this.gameSockets
  }
  getGameService(): GameService {
    return this.gameService
  }
  getUsers(): Users {
    return this.users
  }
  getImages(): Images {
    return this.images
  }
  getImageResize(): ImageResize {
    return this.imageResize
  }
  getTokensRepo(): TokensRepo {
    return this.tokensRepo
  }
  getAnnouncementsRepo(): AnnouncementsRepo {
    return this.announcementsRepo
  }
  getLeaderboardRepo(): LeaderboardRepo {
    return this.leaderboardRepo
  }

  async persistGame(gameId: string): Promise<void> {
    const game: GameType|null = GameCommon.get(gameId)
    if (!game) {
      log.error(`[ERROR] unable to persist non existing game ${gameId}`)
      return
    }
    await this.gameService.persistGame(game)
  }

  async persistGames(): Promise<void> {
    for (const gameId of this.gameService.dirtyGameIds()) {
      await this.persistGame(gameId)
    }
  }

  start() {
    const port = config.http.port
    const hostname = config.http.hostname
    const app = express()

    app.use(cookieParser())
    app.use(compression())

    // add user info to all requests
    app.use(async (req: any, _res, next: NextFunction) => {
      const data = await this.users.getUserInfoByRequest(req)
      req.token = data.token
      req.user = data.user
      req.user_type = data.user_type
      next()
    })

    app.use('/admin/api', createAdminApiRouter(this))
    app.use('/api', createApiRouter(this))
    app.use('/image-service', createImageServiceRouter(this))
    app.use('/uploads/', express.static(config.dir.UPLOAD_DIR))
    app.use('/', express.static(config.dir.PUBLIC_DIR))

    app.all('*', async (req: any, res) => {
      res.sendFile(indexFile);
    })

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
        const clientId = proto[0]
        const gameId = proto[1]
        this.gameSockets.removeSocket(gameId, socket)

        const ts = Time.timestamp()
        const clientSeq = -1 // client lost connection, so clientSeq doesn't matter
        const clientEvtData = [ Protocol.INPUT_EV_CONNECTION_CLOSE ]
        const changes = await this.gameService.handleInput(gameId, clientId, clientEvtData, ts)
        const sockets = this.gameSockets.getSockets(gameId)
        if (sockets.length) {
          notify(
            [Protocol.EV_SERVER_EVENT, clientId, clientSeq, changes],
            sockets
          )
        } else {
          this.persistGame(gameId)
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
              const gameObject = await this.gameService.loadGame(gameId)
              if (!gameObject) {
                throw `[game ${gameId} does not exist... ]`
              }
              GameCommon.setGame(gameObject.id, gameObject)
            }
            const ts = Time.timestamp()
            this.gameService.addPlayer(gameId, clientId, ts)
            this.gameSockets.addSocket(gameId, socket)

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
              const gameObject = await this.gameService.loadGame(gameId)
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
              this.gameService.addPlayer(gameId, clientId, ts)
              sendGame = true
            }
            if (!this.gameSockets.socketExists(gameId, socket)) {
              this.gameSockets.addSocket(gameId, socket)
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

            const changes = await this.gameService.handleInput(gameId, clientId, clientEvtData, ts)
            notify(
              [Protocol.EV_SERVER_EVENT, clientId, clientSeq, changes],
              this.gameSockets.getSockets(gameId)
            )
          } break
        }
      } catch (e) {
        log.error(e)
        log.error('data:', data)
      }
    })

    this.webserver = app.listen(
      port,
      hostname,
      () => log.log(`server running on http://${hostname}:${port}`)
    )
    wss.listen()
    this.websocketserver = wss
  }

  close(): void {
    log.log('shutting down webserver...')
    if (this.webserver) {
      this.webserver.close()
      this.webserver = null
    }

    log.log('shutting down websocketserver...')
    if (this.websocketserver) {
      this.websocketserver.close()
      this.websocketserver = null
    }
  }
}
