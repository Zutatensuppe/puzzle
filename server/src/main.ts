import { logger } from '../../common/src/Util'
import Time from '../../common/src/Time'
import v8 from 'v8'
import config from './Config'
import Db from './Db'
import Mail from './Mail'
import { Canny } from './Canny'
import { Discord } from './Discord'
import { Server } from './Server'
import { GameSockets } from './GameSockets'
import { GameService } from './GameService'
import { GamesRepo } from './repo/GamesRepo'
import { Users } from './Users'
import { ImagesRepo } from './repo/ImagesRepo'
import { Images } from './Images'
import { TokensRepo } from './repo/TokensRepo'
import { AnnouncementsRepo } from './repo/AnnouncementsRepo'
import { ImageResize } from './ImageResize'
import { PuzzleService } from './PuzzleService'
import { LeaderboardRepo } from './repo/LeaderboardRepo'
import { UsersRepo } from './repo/UsersRepo'
import { Twitch } from './Twitch'
import { UrlUtil } from './UrlUtil'

const run = async () => {
  const db = new Db(config.db.connectStr, config.dir.DB_PATCHES_DIR)
  await db.connect()
  await db.patch()

  const mail = new Mail(config.mail, config.http.publicBaseUrl)
  const canny = new Canny(config.canny)
  const discord = new Discord(config.discord)
  const gameSockets = new GameSockets()
  const gamesRepo = new GamesRepo(db)
  const imagesRepo = new ImagesRepo(db)
  const users = new Users(db)
  const usersRepo = new UsersRepo(db)
  const images = new Images(imagesRepo)
  const imageResize = new ImageResize(images)
  const tokensRepo = new TokensRepo(db)
  const announcementsRepo = new AnnouncementsRepo(db)
  const puzzleService = new PuzzleService(images)
  const leaderboardRepo = new LeaderboardRepo(db)
  const gameService = new GameService(gamesRepo, usersRepo, imagesRepo, puzzleService, leaderboardRepo)
  const twitch = new Twitch(config.auth.twitch)

  const server = new Server(
    db,
    mail,
    canny,
    discord,
    gameSockets,
    gameService,
    users,
    images,
    imageResize,
    tokensRepo,
    new UrlUtil(),
    announcementsRepo,
    leaderboardRepo,
    imagesRepo,
    twitch,
  )
  server.start()

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
  let persistInterval: any = null
  const doPersist = async () => {
    log.log('Persisting games...')
    await server.persistGames()
    memoryUsageHuman()
    persistInterval = setTimeout(doPersist, config.persistence.interval)
  }
  persistInterval = setTimeout(doPersist, config.persistence.interval)

  // check for livestreams
  let checkLivestreamsInterval: any = null
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
    clearInterval(persistInterval)

    log.log('clearing check livestreams interval...')
    clearInterval(checkLivestreamsInterval)

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

run()
