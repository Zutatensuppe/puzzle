import { logger } from '../../common/src/Util'
import Time from '../../common/src/Time'
import GameCommon from '../../common/src/GameCommon'
import v8 from 'v8'
import config from './Config'
import Db from './Db'
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
import GameLog from './GameLog'
import { ImageExif } from './ImageExif'
import { Repos } from './repo/Repos'
import { Moderation } from './Moderation'
import { ImageChecksumMigration } from './migrations/ImageChecksumMigration'

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
  )
  server.init()

  // TODO: remove after the migration has run
  const migration = new ImageChecksumMigration(server)
  void migration.run()

  server.listen()

  const log = logger('main.js')

  const memoryUsageHuman = (): void => {
    const totalHeapSize = v8.getHeapStatistics().total_available_size
    const totalHeapSizeInGB = (totalHeapSize / 1024 / 1024 / 1024).toFixed(2)

    log.log(`Total heap size (bytes) ${totalHeapSize}, (GB ~${totalHeapSizeInGB})`)
    const used = process.memoryUsage().heapUsed / 1024 / 1024
    log.log(`Mem: ${Math.round(used * 100) / 100}M`)
  }

  memoryUsageHuman()

  // persist games in fixed interval
  let persistInterval: ReturnType<typeof setTimeout> | null = null
  const doPersist = async () => {
    log.log('Persisting games...')
    await server.persistGames()
    memoryUsageHuman()
    persistInterval = setTimeout(doPersist, config.persistence.interval)
  }
  persistInterval = setTimeout(doPersist, config.persistence.interval)

  // unload games in fixed interval
  let idlecheckInterval: ReturnType<typeof setTimeout> | null = null
  const doIdlecheck = async () => {
    log.log('doIdlecheck...')
    const idleGameIds = server.gameSockets.updateIdle()
    for (const gameId of idleGameIds) {
      await server.persistGame(gameId)
      log.info(`[INFO] unloading game: ${gameId}`)
      GameCommon.unsetGame(gameId)
      GameLog.unsetGame(gameId)
      server.gameSockets.removeSocketInfo(gameId)
    }
    idlecheckInterval = setTimeout(doIdlecheck, config.idlecheck.interval)
  }
  idlecheckInterval = setTimeout(doIdlecheck, config.idlecheck.interval)


  // check for livestreams
  let checkLivestreamsInterval: ReturnType<typeof setTimeout> | null = null
  const updateLivestreamsInfo = () => {
    log.log('Checking for livestreams...')
    server.updateLivestreamsInfo().then(() => {
      checkLivestreamsInterval = setTimeout(updateLivestreamsInfo, 1 * Time.MIN)
    }).catch(error => {
      log.error(error)
    })
  }
  updateLivestreamsInfo()

  const gracefulShutdown = async (signal: string): Promise<void> => {
    log.log(`${signal} received...`)

    log.log('clearing persist interval...')
    if (persistInterval) {
      clearTimeout(persistInterval)
    }

    log.log('clearing idlecheck interval...')
    if (idlecheckInterval) {
      clearTimeout(idlecheckInterval)
    }

    log.log('clearing check livestreams interval...')
    if (checkLivestreamsInterval) {
      clearTimeout(checkLivestreamsInterval)
    }

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
