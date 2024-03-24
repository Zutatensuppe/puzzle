import WebSocketServer from './WebSocketServer'
import WebSocket from 'ws'
import express, { NextFunction, Request, Response } from 'express'
import compression from 'compression'
import { CLIENT_EVENT_TYPE, GAME_EVENT_TYPE, SERVER_EVENT_TYPE } from '../../common/src/Protocol'
import Util, { logger } from '../../common/src/Util'
import { GameSockets } from './GameSockets'
import Time from '../../common/src/Time'
import config from './Config'
import GameCommon from '../../common/src/GameCommon'
import { ServerEvent, Game as GameType, ClientEvent, GameEventInputConnectionClose } from '../../common/src/Types'
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
import { Server as HttpServer } from 'http'
import path from 'path'
import { Images } from './Images'
import { TokensRepo } from './repo/TokensRepo'
import { AnnouncementsRepo } from './repo/AnnouncementsRepo'
import { ImageResize } from './ImageResize'
import { LeaderboardRepo } from './repo/LeaderboardRepo'
import { ImagesRepo } from './repo/ImagesRepo'
import fs from 'fs'
import { storeImageSnapshot } from './ImageSnapshots'
import { Twitch } from './Twitch'

const indexFile = path.resolve(config.dir.PUBLIC_DIR, 'index.html')
const indexFileContents = fs.readFileSync(indexFile, 'utf-8')

const sendHtml = (res: Response, tmpl: string, data: Record<string, string> = {}): void => {
  let str = tmpl
  for (const key of Object.keys(data)) {
    str = str.replace(key, data[key])
  }

  res.setHeader('Content-Type', 'text/html')
  res.send(str)
}

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
  getImagesRepo: () => ImagesRepo
  getTwitch: () => Twitch
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
    private readonly imagesRepo: ImagesRepo,
    private readonly twitch: Twitch,
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
  getImagesRepo(): ImagesRepo {
    return this.imagesRepo
  }
  getTwitch(): Twitch {
    return this.twitch
  }

  async persistGame(gameId: string): Promise<void> {
    const game: GameType | null = GameCommon.get(gameId)
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

    app.get('/', async (req: any, res) => {
      sendHtml(res, indexFileContents, {
        '<!-- og:image -->': '<meta property="og:image" content="/assets/textures/poster.webp" />',
      })
    })
    app.use('/', express.static(config.dir.PUBLIC_DIR))

    app.get('/g/:id', async (req: Request, res: Response) => {
      const gameId = req.params.id
      const loaded = await this.gameService.ensureLoaded(gameId)
      if (!loaded) {
        res.status(404).send('Game not found')
        return
      }

      sendHtml(res, indexFileContents, {
        '<!-- og:image -->': '<meta property="og:image" content="'+  GameCommon.getImageUrl(gameId) +'" />',
      })
    })

    app.get('/replay/:id', async (req: Request, res: Response) => {
      const gameId = req.params.id
      const loaded = await this.gameService.ensureLoaded(gameId)
      if (!loaded) {
        res.status(404).send('Game not found')
        return
      }

      sendHtml(res, indexFileContents, {
        '<!-- og:image -->': '<meta property="og:image" content="'+  GameCommon.getImageUrl(gameId) +'" />',
      })
    })

    app.all('*', async (req: any, res) => {
      sendHtml(res, indexFileContents, {
        '<!-- og:image -->': '<meta property="og:image" content="/assets/textures/poster.webp" />',
      })
    })

    const wss = new WebSocketServer(config.ws)

    const notify = (data: ServerEvent, sockets: Array<WebSocket>): void => {
      for (const socket of sockets) {
        wss.notifyOne(data, socket)
      }
    }

    wss.on('close', async (
      { socket }: { socket: WebSocket },
    ): Promise<void> => {
      try {
        const proto = socket.protocol.split('|')
        const clientId = proto[0]
        const gameId = proto[1]
        this.gameSockets.removeSocket(gameId, socket)

        const ts = Time.timestamp()
        const clientSeq = -1 // client lost connection, so clientSeq doesn't matter
        const gameEvent: GameEventInputConnectionClose = [GAME_EVENT_TYPE.INPUT_EV_CONNECTION_CLOSE]
        const ret = await this.gameService.handleGameEvent(gameId, clientId, gameEvent, ts)
        const sockets = this.gameSockets.getSockets(gameId)
        if (sockets.length) {
          notify(
            [SERVER_EVENT_TYPE.UPDATE, clientId, clientSeq, ret.changes],
            sockets,
          )
        } else {
          await this.persistGame(gameId)
          log.info(`[INFO] unloading game: ${gameId}`)
          GameCommon.unsetGame(gameId)
        }

      } catch (e) {
        log.error(e)
      }
    })

    wss.on('message', async (
      { socket, data }: { socket: WebSocket, data: string },
    ): Promise<void> => {
      try {
        const proto = socket.protocol.split('|')
        const clientId = proto[0]
        const gameId = proto[1]
        const msg = JSON.parse(data) as ClientEvent
        const msgType = msg[0]
        switch (msgType) {
          case CLIENT_EVENT_TYPE.INIT: {
            log.log(`ws`, socket.protocol, msgType)
            const loaded = await this.gameService.ensureLoaded(gameId)
            if (!loaded) {
              throw `[game ${gameId} does not exist... ]`
            }
            const ts = Time.timestamp()
            this.gameService.addPlayer(gameId, clientId, ts)
            this.gameSockets.addSocket(gameId, socket)

            const game: GameType | null = GameCommon.get(gameId)
            if (!game) {
              throw `[game ${gameId} does not exist (anymore)... ]`
            }
            game.registeredMap = await this.gameService.generateRegisteredMap(game)

            const encodedGame = Util.encodeGame(game)
            notify([SERVER_EVENT_TYPE.INIT, encodedGame], [socket])
            notify([SERVER_EVENT_TYPE.SYNC, encodedGame], this.gameSockets.getSockets(gameId).filter(s => s !== socket))
          } break

          case CLIENT_EVENT_TYPE.UPDATE: {
            log.log(`ws`, socket.protocol, msgType)
            const loaded = await this.gameService.ensureLoaded(gameId)
            if (!loaded) {
              throw `[game ${gameId} does not exist... ]`
            }
            const clientSeq = msg[1]
            const gameEvent = msg[2]
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
              const game: GameType | null = GameCommon.get(gameId)
              if (!game) {
                throw `[game ${gameId} does not exist (anymore)... ]`
              }

              game.registeredMap = await this.gameService.generateRegisteredMap(game)
              const encodedGame = Util.encodeGame(game)
              notify([SERVER_EVENT_TYPE.INIT, encodedGame], [socket])
              notify([SERVER_EVENT_TYPE.SYNC, encodedGame], this.gameSockets.getSockets(gameId).filter(s => s !== socket))
            }

            const ret = await this.gameService.handleGameEvent(gameId, clientId, gameEvent, ts)
            notify(
              [SERVER_EVENT_TYPE.UPDATE, clientId, clientSeq, ret.changes],
              this.gameSockets.getSockets(gameId),
            )
          } break
          case CLIENT_EVENT_TYPE.IMAGE_SNAPSHOT: {
            log.log(`ws`, socket.protocol, msgType)
            // store the snapshot and update the game table
            const imageBase64Str = msg[1]
            const ts = parseInt(`${msg[2]}`, 10)
            if (isNaN(ts)) {
              // do nothing
              break
            }
            void storeImageSnapshot(imageBase64Str, gameId, ts, this.db)
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
      () => log.log(`server running on http://${hostname}:${port}`),
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

  async updateLivestreamsInfo(): Promise<void> {
    const livestreams = await this.twitch.getLivestreams()
    const liveIds = livestreams.map(l => l.id)

    const liveLivestreams = await this.db.getMany('twitch_livestreams', { is_live: 1 })
    const oldLiveIds = liveLivestreams.map(l => l.livestream_id)

    const notLiveAnymore = oldLiveIds.filter(id => !liveIds.includes(id))
    const newLiveIds = liveIds.filter(id => !oldLiveIds.includes(id))
    const stillLiveIds = liveIds.filter(id => oldLiveIds.includes(id))

    await this.db.update('twitch_livestreams', { is_live: 0 }, { livestream_id: { '$in': notLiveAnymore } })

    const stillLiveStreams = livestreams.filter(l => stillLiveIds.includes(l.id))
    const newLiveStreams = livestreams.filter(l => newLiveIds.includes(l.id))

    // add streams that are new
    for (const stream of newLiveStreams) {
      await this.db.insert('twitch_livestreams', {
        livestream_id: stream.id,
        title: stream.title,
        url: stream.url,
        user_display_name: stream.user_display_name,
        user_thumbnail: stream.user_thumbnail,
        language: stream.language,
        viewers: stream.viewers,
        is_live: 1,
      })
    }

    // update streams that are still live
    for (const stream of stillLiveStreams) {
      await this.db.update('twitch_livestreams', {
        title: stream.title,
        url: stream.url,
        user_display_name: stream.user_display_name,
        user_thumbnail: stream.user_thumbnail,
        language: stream.language,
        viewers: stream.viewers,
      }, { livestream_id: stream.id })
    }
  }
}
