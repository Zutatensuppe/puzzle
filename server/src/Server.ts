import WebSocketServer from './WebSocketServer'
import type WebSocket from 'ws'
import express from 'express'
import type { NextFunction, Request, Response } from 'express'
import compression from 'compression'
import { CLIENT_EVENT_TYPE, GAME_EVENT_TYPE, SERVER_EVENT_TYPE } from '@common/Protocol'
import Util, { logger } from '@common/Util'
import type { GameSockets } from './GameSockets'
import Time from '@common/Time'
import config from './Config'
import GameCommon from '@common/GameCommon'
import type { ServerEvent, Game as GameType, ClientEvent, GameEventInputConnectionClose, GameId, ClientId, EncodedGame, EncodedGameLegacy, ClientInitEvent, ClientUpdateEvent, ClientImageSnapshotEvent, LivestreamsRow } from '@common/Types'
import type { GameService } from './GameService'
import createApiRouter from './web_routes/api'
import createAdminApiRouter from './web_routes/admin/api'
import createImageServiceRouter from './web_routes/image-service'
import cookieParser from 'cookie-parser'
import type { Users } from './Users'
import type Mail from './Mail'
import type { Canny } from './Canny'
import type { Discord } from './Discord'
import type Db from './lib/Db'
import type { Server as HttpServer } from 'http'
import path from 'path'
import type { Images } from './Images'
import type { ImageResize } from './ImageResize'
import { storeImageSnapshot } from './ImageSnapshots'
import type { Twitch } from './Twitch'
import type { UrlUtil } from './UrlUtil'
import fs from './lib/FileSystem'
import type { Repos } from './repo/Repos'
import type { Moderation } from './Moderation'
import type { Workers } from './workers/Workers'
import v8 from 'v8'

const DEFAULT_OG_IMAGE_URL = '/assets/textures/poster.webp'

const replaceTemplateData = (tmpl: string, data: Record<string, string> = {}): string => {
  let str = tmpl
  for (const key of Object.keys(data)) {
    str = str.replace(key, data[key])
  }
  return str
}

const log = logger('Server.ts')

export class Server {
  private webserver: HttpServer | null = null
  private websocketserver: WebSocketServer | null = null

  private _indexFileContents: string | null = null

  constructor(
    public readonly db: Db,
    public readonly repos: Repos,
    public readonly mail: Mail,
    public readonly canny: Canny,
    public readonly discord: Discord,
    public readonly gameSockets: GameSockets,
    public readonly gameService: GameService,
    public readonly users: Users,
    public readonly images: Images,
    public readonly imageResize: ImageResize,
    public readonly urlUtil: UrlUtil,
    public readonly twitch: Twitch,
    public readonly moderation: Moderation,
    public readonly workers: Workers,
  ) {
    // pass
  }

  public syncGameToClients(
    gameId: GameId,
    encodedGame: EncodedGame | EncodedGameLegacy,
  ) {
    for (const socket of this.gameSockets.getSockets(gameId)) {
      this.websocketserver?.notifyOne([SERVER_EVENT_TYPE.SYNC, encodedGame], socket)
    }
  }

  public persistGame(gameId: GameId): Promise<void> {
    return this.gameService.persistGameById(gameId)
  }

  public async getEncodedGameForSync(
    gameId: GameId,
  ): Promise<EncodedGame | EncodedGameLegacy> {
    const game: GameType | null = GameCommon.get(gameId)
    if (!game) {
      throw `[game ${gameId} does not exist (anymore)... ]`
    }
    game.registeredMap = await this.gameService.generateRegisteredMap(game.players)
    return Util.encodeGame(game)
  }

  public async persistGames(): Promise<void> {
    for (const gameId of this.gameService.dirtyGameIds()) {
      await this.persistGame(gameId)
    }
  }

  private async indexFileContents(): Promise<string> {
    if (this._indexFileContents !== null) {
      return this._indexFileContents
    }
    const indexFile = path.resolve(config.dir.PUBLIC_DIR, 'index.html')
    this._indexFileContents = await fs.exists(indexFile)
      ? await fs.readFile(indexFile)
      : 'INDEX FILE MISSING'
    return this._indexFileContents
  }

  public init(): void {
    this.repos.init(this)
    this.gameService.init(this)
    this.moderation.init(this)
    this.workers.init(this)
  }

  private async sendIndex(res: Response, imageUrl: string) {
    res.setHeader('Content-Type', 'text/html')
    res.send(replaceTemplateData(await this.indexFileContents(), {
      '<!-- og:image -->': `<meta property="og:image" content="${imageUrl}" />`,
    }))
  }

  public start() {
    const port = config.http.port
    const hostname = config.http.hostname
    const app = express()

    app.use(cookieParser())
    app.use(compression())

    // add user info to all requests
    app.use(async (req, _res, next: NextFunction) => {
      const data = await this.users.getUserInfoByRequest(req)
      req.userInfo = data
      next()
    })

    app.use('/admin/api', createAdminApiRouter(this))
    app.use('/api', createApiRouter(this))
    app.use('/image-service', createImageServiceRouter(this))
    app.use('/uploads/', express.static(config.dir.UPLOAD_DIR))

    app.get('/', async (_req, res) => {
      await this.sendIndex(res, DEFAULT_OG_IMAGE_URL)
    })
    app.use('/', express.static(config.dir.PUBLIC_DIR))

    app.get('/g/:id', async (req: Request, res: Response) => {
      const gameId = req.params.id as GameId
      const loaded = await this.gameService.ensureLoaded(gameId)
      if (!loaded) {
        res.status(404).send('Game not found')
        return
      }

      await this.sendIndex(res, GameCommon.getImageUrl(gameId))
    })

    app.get('/replay/:id', async (req: Request, res: Response) => {
      const gameId = req.params.id as GameId
      const loaded = await this.gameService.ensureLoaded(gameId)
      if (!loaded) {
        res.status(404).send('Game not found')
        return
      }

      await this.sendIndex(res, GameCommon.getImageUrl(gameId))
    })

    app.all('*', async (_req, res) => {
      await this.sendIndex(res, DEFAULT_OG_IMAGE_URL)
    })

    const wss = new WebSocketServer(config.ws)

    wss.on('close', async (
      { socket }: { socket: WebSocket },
    ): Promise<void> => {
      await this.onWssClose(socket)
    })

    wss.on('message', async (
      { socket, data }: { socket: WebSocket, data: string },
    ): Promise<void> => {
      await this.onWssMessage(socket, data)
    })

    this.webserver = app.listen(
      port,
      hostname,
      () => log.log(`server running on http://${hostname}:${port}`),
    )
    wss.listen()
    this.websocketserver = wss

    this.workers.startAll()
  }

  public close(): void {
    log.log('stopping workers...')
    this.workers.stopAll()

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

  private notify(data: ServerEvent, sockets: WebSocket[]): void {
    if (!this.websocketserver) {
      return
    }

    for (const socket of sockets) {
      this.websocketserver.notifyOne(data, socket)
    }
  }

  private async onWssClose(socket: WebSocket): Promise<void> {
    try {
      const proto = socket.protocol.split('|')
      const clientId = proto[0] as ClientId
      const gameId = proto[1] as GameId
      this.gameSockets.removeSocket(gameId, socket)

      const ts = Time.timestamp()
      const clientSeq = -1 // client lost connection, so clientSeq doesn't matter
      const gameEvent: GameEventInputConnectionClose = [GAME_EVENT_TYPE.INPUT_EV_CONNECTION_CLOSE]

      // the game can be unloaded here, eg. when it is being deleted while someone is playing
      const loaded = await this.gameService.ensureLoaded(gameId)
      if (!loaded) {
        return
      }

      const ret = await this.gameService.handleGameEvent(gameId, clientId, gameEvent, ts)
      const sockets = this.gameSockets.getSockets(gameId)
      if (!sockets.length) {
        return
      }

      this.notify(
        [SERVER_EVENT_TYPE.UPDATE, clientId, clientSeq, ret.changes],
        sockets,
      )
    } catch (e) {
      log.error(e)
    }
  }

  private async onWssMessage(socket: WebSocket, data: string): Promise<void> {
    try {
      const proto = socket.protocol.split('|')
      const clientId = proto[0] as ClientId
      const gameId = proto[1] as GameId
      const msg = JSON.parse(data) as ClientEvent
      const msgType = msg[0]
      switch (msgType) {
        case CLIENT_EVENT_TYPE.INIT: {
          await this.onClientInit(clientId, gameId, msg, socket)
        } break
        case CLIENT_EVENT_TYPE.UPDATE: {
          await this.onClientUpdate(clientId, gameId, msg, socket)
        } break
        case CLIENT_EVENT_TYPE.IMAGE_SNAPSHOT: {
          void this.onClientImageSnapshot(clientId, gameId, msg, socket)
        } break
      }
    } catch (e) {
      log.error(e)
      log.error('data:', data)
    }
  }

  private async onClientInit(
    clientId: ClientId,
    gameId: GameId,
    msg: ClientInitEvent,
    socket: WebSocket,
  ): Promise<void> {
    const loaded = await this.gameService.ensureLoaded(gameId)
    if (!loaded) {
      this.notify([SERVER_EVENT_TYPE.ERROR, { gameDoesNotExist: true }], [socket])
      return
    }

    const user = await this.users.getUser({ client_id: clientId })
    const details = await this.gameService.checkAuth(msg, gameId, clientId, user)
    if (details.requireAccount || details.requirePassword || details.wrongPassword || details.banned) {
      this.notify([SERVER_EVENT_TYPE.ERROR, details], [socket])
      return
    }

    const ts = Time.timestamp()
    this.gameService.addPlayer(gameId, clientId, ts)
    this.gameSockets.addSocket(gameId, socket)

    const encodedGame = await this.getEncodedGameForSync(gameId)
    this.notify([SERVER_EVENT_TYPE.INIT, encodedGame], [socket])
    this.notify([SERVER_EVENT_TYPE.SYNC, encodedGame], this.gameSockets.getSockets(gameId).filter(s => s !== socket))
  }

  private async onClientUpdate(
    clientId: ClientId,
    gameId: GameId,
    msg: ClientUpdateEvent,
    socket: WebSocket,
  ): Promise<void> {
    const loaded = await this.gameService.ensureLoaded(gameId)
    if (!loaded) {
      this.notify([SERVER_EVENT_TYPE.ERROR, { gameDoesNotExist: true }], [socket])
      return
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

    let handled = false
    // handle special admin kind of events
    if (gameEvent[0] === GAME_EVENT_TYPE.INPUT_EV_BAN_PLAYER) {
      handled = true
      const user = await this.users.getUser({ client_id: clientId })
      if (user?.id === GameCommon.getCreatorUserId(gameId)) {
        const playerClientId = gameEvent[1]
        const changed = GameCommon.setPlayerBanned(gameId, playerClientId)
        if (changed) {
          sendGame = true

          this.gameSockets.getSocket(gameId, playerClientId)?.close()
        }
      }
    } else if (gameEvent[0] === GAME_EVENT_TYPE.INPUT_EV_UNBAN_PLAYER) {
      handled = true
      const user = await this.users.getUser({ client_id: clientId })
      if (user?.id === GameCommon.getCreatorUserId(gameId)) {
        const playerClientId = gameEvent[1]
        const changed = GameCommon.setPlayerUnbanned(gameId, playerClientId)
        if (changed) {
          sendGame = true
        }
      }
    }

    if (sendGame) {
      const encodedGame = await this.getEncodedGameForSync(gameId)
      this.notify([SERVER_EVENT_TYPE.INIT, encodedGame], [socket])
      this.notify([SERVER_EVENT_TYPE.SYNC, encodedGame], this.gameSockets.getSockets(gameId))
    }

    if (!handled) {
      const ret = await this.gameService.handleGameEvent(gameId, clientId, gameEvent, ts)
      this.notify(
        [SERVER_EVENT_TYPE.UPDATE, clientId, clientSeq, ret.changes],
        this.gameSockets.getSockets(gameId),
      )
    }
  }

  private async onClientImageSnapshot(
    _clientId: ClientId,
    gameId: GameId,
    msg: ClientImageSnapshotEvent,
    _socket: WebSocket,
  ): Promise<void> {
    // store the snapshot and update the game table
    const ts = parseInt(`${msg[2]}`, 10)
    if (isNaN(ts)) {
      return
    }
    const imageBase64Str = msg[1]
    await storeImageSnapshot(imageBase64Str, gameId, ts, this.db)
  }

  public async updateLivestreamsInfo(): Promise<void> {
    const livestreams = await this.twitch.getLivestreams()
    const liveIds = livestreams.map(l => l.id)

    const liveLivestreams = await this.repos.livestreams.getLive()
    const oldLiveIds = liveLivestreams.map(l => l.livestream_id)

    const notLiveAnymore = oldLiveIds.filter(id => !liveIds.includes(id))
    const newLiveIds = liveIds.filter(id => !oldLiveIds.includes(id))
    const stillLiveIds = liveIds.filter(id => oldLiveIds.includes(id))

    await this.repos.livestreams.update({ is_live: 0 }, { livestream_id: { '$in': notLiveAnymore } })

    const stillLiveStreams = livestreams.filter(l => stillLiveIds.includes(l.id))
    const newLiveStreams = livestreams.filter(l => newLiveIds.includes(l.id))

    // add streams that are new
    const newLiveStreamRows: Omit<LivestreamsRow, 'id'>[] = newLiveStreams.map(stream => ({
      livestream_id: stream.id,
      title: stream.title,
      url: stream.url,
      user_display_name: stream.user_display_name,
      user_thumbnail: stream.user_thumbnail,
      language: stream.language,
      viewers: stream.viewers,
      is_live: 1,
    }))
    await this.repos.livestreams.insertMany(newLiveStreamRows)

    // update streams that are still live
    for (const stream of stillLiveStreams) {
      await this.repos.livestreams.update({
        title: stream.title,
        url: stream.url,
        user_display_name: stream.user_display_name,
        user_thumbnail: stream.user_thumbnail,
        language: stream.language,
        viewers: stream.viewers,
      }, { livestream_id: stream.id })
    }
  }

  public logMemoryUsageHuman(): void {
    const totalHeapSize = v8.getHeapStatistics().total_available_size
    const totalHeapSizeInGB = (totalHeapSize / 1024 / 1024 / 1024).toFixed(2)

    log.log(`Total heap size (bytes) ${totalHeapSize}, (GB ~${totalHeapSizeInGB})`)
    const used = process.memoryUsage().heapUsed / 1024 / 1024
    log.log(`Mem: ${Math.round(used * 100) / 100}M`)
  }
}
