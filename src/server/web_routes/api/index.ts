import { GameSettings, Game as GameType } from '../../../common/Types'
import config from '../../Config'
import Db from '../../Db'
import express, { Router } from 'express'
import Game from '../../Game'
import GameCommon from '../../../common/GameCommon'
import GameLog from '../../GameLog'
import GameStorage from '../../GameStorage'
import Images from '../../Images'
import multer from 'multer'
import request from 'request'
import Time from '../../../common/Time'
import Users from '../../Users'
import Util, { logger } from '../../../common/Util'
import { generateToken, passwordHash } from '../../Auth'

const log = logger('web_routes/api/index.ts')

interface SaveImageRequestData {
  id: number
  title: string
  tags: string[]
}

export default function createRouter(
  db: Db
): Router {
  const storage = multer.diskStorage({
    destination: config.dir.UPLOAD_DIR,
    filename: function (req, file, cb) {
      cb(null , `${Util.uniqId()}-${file.originalname}`);
    }
  })
  const upload = multer({storage}).single('file');

  const router = express.Router()
  router.get('/me', async (req: any, res): Promise<void> => {
    const user = await Users.getUser(db, req)
    res.send({
      id: user ? user.id : null,
      created: user ? user.created : null,
      loggedIn: !!req.token,
    })
  })

  router.post('/auth', express.json(), async (req, res): Promise<void> => {
    const loginPlain = req.body.login
    const passPlain = req.body.pass
    const user = await db.get('users', { login: loginPlain })
    if (!user) {
      res.status(401).send({ reason: 'bad credentials' })
      return
    }
    const salt = user.salt
    const passHashed = passwordHash(passPlain, salt)
    if (user.pass !== passHashed) {
      res.status(401).send({ reason: 'bad credentials' })
      return
    }
    const token = generateToken()
    await db.insert('tokens', { user_id: user.id, token, type: 'auth' })
    res.cookie('x-token', token, { maxAge: 356 * Time.DAY, httpOnly: true })
    res.send({ success: true })
  })

  router.post('/logout', async (req: any, res): Promise<void> => {
    if (!req.token) {
      res.status(401).send({})
      return
    }
    await db.delete('tokens', { token: req.token })
    res.clearCookie("x-token")
    res.send({ success: true })
  })

  router.get('/conf', (req, res): void => {
    res.send({
      WS_ADDRESS: config.ws.connectstring,
    })
  })

  router.get('/replay-data', async (req, res): Promise<void> => {
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
        log[0][2], // targetPieceCount
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

  router.get('/newgame-data', async (req, res): Promise<void> => {
    const q: Record<string, any> = req.query
    const tagSlugs: string[] = q.tags ? q.tags.split(',') : []
    res.send({
      images: await Images.allImagesFromDb(db, tagSlugs, q.sort, false),
      tags: await Images.getAllTags(db),
    })
  })

  router.get('/index-data', async (req, res): Promise<void> => {
    const ts = Time.timestamp()
    const rows = await GameStorage.getAllPublicGames(db)
    const games = [
      ...rows.sort((a: GameType, b: GameType) => {
        const finished = GameCommon.Game_isFinished(a)
        // when both have same finished state, sort by started
        if (finished === GameCommon.Game_isFinished(b)) {
          if (finished) {
            return  b.puzzle.data.finished - a.puzzle.data.finished
          }
          return b.puzzle.data.started - a.puzzle.data.started
        }
        // otherwise, sort: unfinished, finished
        return finished ? 1 : -1
      }).map((game: GameType) => ({
        id: game.id,
        hasReplay: GameLog.hasReplay(game),
        started: GameCommon.Game_getStartTs(game),
        finished: GameCommon.Game_getFinishTs(game),
        piecesFinished: GameCommon.Game_getFinishedPiecesCount(game),
        piecesTotal: GameCommon.Game_getPieceCount(game),
        players: GameCommon.Game_getActivePlayers(game, ts).length,
        imageUrl: GameCommon.Game_getImageUrl(game),
      })),
    ]

    res.send({
      gamesRunning: games.filter(g => !g.finished),
      gamesFinished: games.filter(g => !!g.finished),
    })
  })

  router.post('/save-image', express.json(), async (req, res): Promise<void> => {
    const user = await Users.getUser(db, req)
    if (!user || !user.id) {
      res.status(403).send({ ok: false, error: 'forbidden' })
      return
    }

    const data = req.body as SaveImageRequestData
    const image = await db.get('images', {id: data.id})
    if (parseInt(image.uploader_user_id, 10) !== user.id) {
      res.status(403).send({ ok: false, error: 'forbidden' })
      return
    }

    await db.update('images', {
      title: data.title,
    }, {
      id: data.id,
    })

    await Images.setTags(db, data.id, data.tags || [])

    res.send({ ok: true })
  })

  router.get('/proxy', (req: any, res): void => {
    log.info('proxy request for url:', req.query.url)
    request(req.query.url).pipe(res);
  })

  router.post('/upload', (req: any, res): void => {
    upload(req, res, async (err: any): Promise<void> => {
      if (err) {
        log.log('/api/upload/', 'error', err)
        res.status(400).send("Something went wrong!")
        return
      }

      log.info('req.file.filename', req.file.filename)
      try {
        await Images.resizeImage(req.file.filename)
      } catch (err) {
        log.log('/api/upload/', 'resize error', err)
        res.status(400).send("Something went wrong!")
        return
      }

      const user = await Users.getOrCreateUser(db, req)

      const dim = await Images.getDimensions(
        `${config.dir.UPLOAD_DIR}/${req.file.filename}`
      )
      // post form, so booleans are submitted as 'true' | 'false'
      const isPrivate = req.body.private === 'false' ? 0 : 1;
      const imageId = await db.insert('images', {
        uploader_user_id: user.id,
        filename: req.file.filename,
        filename_original: req.file.originalname,
        title: req.body.title || '',
        created: new Date(),
        width: dim.w,
        height: dim.h,
        private: isPrivate,
      }, 'id')

      if (req.body.tags) {
        const tags = req.body.tags.split(',').filter((tag: string) => !!tag)
        await Images.setTags(db, imageId as number, tags)
      }

      res.send(await Images.imageFromDb(db, imageId as number))
    })
  })

  router.post('/newgame', express.json(), async (req, res): Promise<void> => {
    const user = await Users.getOrCreateUser(db, req)
    const gameId = await Game.createNewGame(
      db,
      req.body as GameSettings,
      Time.timestamp(),
      user.id
    )
    res.send({ id: gameId })
  })
  return router
}
