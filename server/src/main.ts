import config from './Config'
import Db from './lib/Db'
import Mail from './Mail'
import { Canny } from './Canny'
import { Discord } from './Discord'
import { Server } from './Server'
import { GameSockets } from './GameSockets'
import { GameService } from './GameService'
import { Users } from './Users'
import { Images } from './Images'
import { ImageResize } from './ImageResize'
import { PuzzleService } from './PuzzleService'
import { Twitch } from './Twitch'
import { UrlUtil } from './UrlUtil'
import { ImageExif } from './ImageExif'
import { Repos } from './repo/Repos'
import { Moderation } from './Moderation'
import { Workers } from './workers/Workers'
import { logger } from '@common/Util'

const run = async () => {
  const db = new Db(config.db.connectStr, config.dir.DB_PATCHES_DIR)
  await db.connect()
  await db.patch()

  const repos = new Repos(db)
  const mail = new Mail(config.mail, config.http.publicBaseUrl)
  const canny = new Canny(config.canny)
  const discord = new Discord(config.discord)
  const gameSockets = new GameSockets()
  const imageExif = new ImageExif()
  const images = new Images(repos.images, imageExif)
  const imageResize = new ImageResize(imageExif)
  const puzzleService = new PuzzleService()
  const gameService = new GameService(puzzleService)
  const twitch = new Twitch(config.auth.twitch)
  const moderation = new Moderation()
  const users = new Users(db, repos, images, gameService)

  const server = new Server(
    db,
    repos,
    mail,
    canny,
    discord,
    gameSockets,
    gameService,
    users,
    images,
    imageResize,
    new UrlUtil(),
    twitch,
    moderation,
    new Workers(),
  )
  server.init()

  server.listen()

  const log = logger('main.js')

  const gracefulShutdown = async (signal: string): Promise<void> => {
    log.log(`${signal} received...`)

    log.log('Persisting games...')
    await server.persistGames()

    log.log('shutting down server...')
    server.close()

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

void run()
