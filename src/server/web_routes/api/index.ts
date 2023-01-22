import { GameSettings, Game as GameType, GameInfo, ApiDataIndexData, ApiDataFinishedGames } from '../../../common/Types'
import config from '../../Config'
import Db from '../../Db'
import express, { Response, Router } from 'express'
import Game from '../../Game'
import GameCommon from '../../../common/GameCommon'
import GameLog from '../../GameLog'
import GameStorage from '../../GameStorage'
import Images from '../../Images'
import multer from 'multer'
import request from 'request'
import Time from '../../../common/Time'
import Users from '../../Users'
import Util, { logger, uniqId } from '../../../common/Util'
import { COOKIE_TOKEN, generateSalt, generateToken, passwordHash } from '../../Auth'
import Mail from '../../Mail'
import { Canny } from '../../Canny'

const log = logger('web_routes/api/index.ts')

interface SaveImageRequestData {
  id: number
  title: string
  tags: string[]
}
const GAMES_PER_PAGE_LIMIT = 10
const IMAGES_PER_PAGE_LIMIT = 20

const addAuthToken = async (db: Db, userId: number, res: Response): Promise<void> => {
  const token = await Users.addAuthToken(db, userId)
  res.cookie(COOKIE_TOKEN, token, { maxAge: 356 * Time.DAY, httpOnly: true })
}

export default function createRouter(
  db: Db,
  mail: Mail,
  canny: Canny,
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
    if (req.user) {
      const groups = await Users.getGroups(db, req.user.id)
      res.send({
        id: req.user.id,
        name: req.user.name,
        clientId: req.user.client_id,
        created: req.user.created,
        type: req.user_type,
        cannyToken: canny.createToken(req.user),
        groups: groups.map(g => g.name),
      })
      return
    }
    res.status(401).send({ reason: 'no user' })
    return
  })

  // login via twitch (callback url called from twitch after authentication)
  router.get('/auth/twitch/redirect_uri', async (req: any, res): Promise<void> => {
    if (!req.query.code) {

      // in error case:
      // http://localhost:3000/
      // ?error=access_denied
      // &error_description=The+user+denied+you+access
      // &state=c3ab8aa609ea11e793ae92361f002671
      res.status(403).send({ reason: req.query })
      return
    }

    // in success case:
    // http://localhost:3000/
    // ?code=gulfwdmys5lsm6qyz4xiz9q32l10
    // &scope=channel%3Amanage%3Apolls+channel%3Aread%3Apolls
    // &state=c3ab8aa609ea11e793ae92361f002671
    const body = {
      client_id: config.auth.twitch.client_id,
      client_secret: config.auth.twitch.client_secret,
      code: req.query.code,
      grant_type: 'authorization_code',
      redirect_uri: ''
    }
    const redirectUris = [
      `https://${config.http.public_hostname}/api/auth/twitch/redirect_uri`,
      `${req.protocol}://${req.headers.host}/api/auth/twitch/redirect_uri`,
    ]
    for (const redirectUri of redirectUris) {
      body.redirect_uri = redirectUri
      const tokenRes = await fetch(`https://id.twitch.tv/oauth2/token${Util.asQueryArgs(body)}`, {
        method: 'POST',
      })
      if (!tokenRes.ok) {
        continue
      }

      interface TwitchOauthTokenResponseData {
        access_token: string
        refresh_token: string
        expires_in: number
        scope: string[]
        token_type: string
      }
      const tokenData = await tokenRes.json() as TwitchOauthTokenResponseData

      // get user

      const userRes = await fetch(`https://api.twitch.tv/helix/users`, {
        headers: {
          'Client-ID': config.auth.twitch.client_id,
          'Authorization': `Bearer ${tokenData.access_token}`,
        }
      })
      if (!userRes.ok) {
        continue
      }

      const userData = await userRes.json()

      const identity = await Users.getIdentity(db, {
        provider_name: 'twitch',
        provider_id: userData.data[0].id,
      })

      let user = null
      if (req.user) {
        user = req.user
      } else if (identity) {
        user = await Users.getUserByIdentity(db, identity)
      }

      if (!user) {
        user = await Users.createUser(db, {
          name: userData.data[0].display_name,
          created: new Date(),
          client_id: uniqId(),
          email: userData.data[0].email,
        })
      } else {
        let updateNeeded = false
        if (!user.name) {
          user.name = userData.data[0].display_name
          updateNeeded = true
        }
        if (!user.email) {
          user.email = userData.data[0].email
          updateNeeded = true
        }
        if (updateNeeded) {
          await Users.updateUser(db, user)
        }
      }

      if (!identity) {
        Users.createIdentity(db, {
          user_id: user.id,
          provider_name: 'twitch',
          provider_id: userData.data[0].id,
        })
      } else {
        let updateNeeded = false
        if (identity.user_id !== user.id) {
          // maybe we do not have to do this
          identity.user_id = user.id
          updateNeeded = true
        }
        if (!identity.provider_email) {
          identity.provider_email = userData.data[0].email
          updateNeeded = true
        }
        if (updateNeeded) {
          Users.updateIdentity(db, identity)
        }
      }

      await addAuthToken(db, user.id, res)
      res.send('<html><script>window.opener.handleAuthCallback();window.close();</script></html>')
      return
    }

    res.status(403).send({ reason: req.query })
  })

  // login via email + password
  router.post('/auth/local', express.json(), async (req, res): Promise<void> => {
    const emailPlain = req.body.email
    const passwordPlain = req.body.password
    const account = await Users.getAccount(db, { email: emailPlain })
    if (!account) {
      res.status(401).send({ reason: 'bad email' })
      return
    }
    if (account.status !== 'verified') {
      res.status(401).send({ reason: 'email not verified' })
      return
    }
    const salt = account.salt
    const passHashed = passwordHash(passwordPlain, salt)
    if (account.password !== passHashed) {
      res.status(401).send({ reason: 'bad password' })
      return
    }
    const identity = await Users.getIdentity(db, {
      provider_name: 'local',
      provider_id: account.id,
    })
    if (!identity) {
      res.status(401).send({ reason: 'no identity' })
      return
    }

    await addAuthToken(db, identity.user_id, res)
    res.send({ success: true })
  })

  router.post('/change-password', express.json(), async (req: any, res): Promise<void> => {
    const token = `${req.body.token}`
    const passwordRaw = `${req.body.password}`

    const tokenRow = await db.get('tokens', {
      type: 'password-reset',
      token,
    })

    if (!tokenRow) {
      res.status(400).send({ reason: 'no such token' })
      return
    }

    // note: token contains account id, not user id ...
    const account = await Users.getAccount(db, { id: tokenRow.user_id })
    if (!account) {
      res.status(400).send({ reason: 'no such account' })
      return
    }

    const password = passwordHash(passwordRaw, account.salt)
    await db.update('accounts', {
      password: password,
    }, {
      id: account.id
    })

    // remove token, already used
    await db.delete('tokens', tokenRow)

    res.send({ success: true })
  })

  router.post('/send-password-reset-email', express.json(), async (req: any, res): Promise<void> => {
    const emailRaw = `${req.body.email}`

    const account = await Users.getAccount(db, { email: emailRaw })
    if (!account) {
      res.status(400).send({ reason: 'no such email' })
      return
    }
    const identity = await Users.getIdentity(db, {
      provider_name: 'local',
      provider_id: account.id,
    })
    if (!identity) {
      res.status(400).send({ reason: 'no such identity' })
      return
    }
    const user = await Users.getUser(db, {
      id: identity.user_id,
    })
    if (!user) {
      res.status(400).send({ reason: 'no such user' })
      return
    }

    const token = generateToken()
    // TODO: dont misuse token table user id <> account id
    const tokenRow = { user_id: account.id, token, type: 'password-reset' }
    await db.insert('tokens', tokenRow)
    mail.sendPasswordResetMail({ user: { name: user.name, email: emailRaw }, token: tokenRow })
    res.send({ success: true })
  })

  router.post('/register', express.json(), async (req: any, res): Promise<void> => {
    const salt = generateSalt()

    const emailRaw = `${req.body.email}`
    const passwordRaw = `${req.body.password}`
    const usernameRaw = `${req.body.username}`

    // TODO: check if username already taken
    // TODO: check if email already taken
    //       return status 409 in both cases

    const account = await Users.createAccount(db, {
      created: new Date(),
      email: emailRaw,
      password: passwordHash(passwordRaw, salt),
      salt: salt,
      status: 'verification_pending',
    })

    const user = await Users.createUser(db, {
      created: new Date(),
      name: usernameRaw,
      email: emailRaw,
      client_id: uniqId(),
    })

    await Users.createIdentity(db, {
      user_id: user.id,
      provider_name: 'local',
      provider_id: account.id,
    })

    const userInfo = { email: emailRaw, name: usernameRaw }
    const token = generateToken()
    const tokenRow = { user_id: account.id, token, type: 'registration' }
    await db.insert('tokens', tokenRow)
    mail.sendRegistrationMail({ user: userInfo, token: tokenRow })
    res.send({ success: true })
  })

  router.get('/verify-email/:token', async (req, res): Promise<void> => {
    const token = req.params.token
    const tokenRow = await db.get('tokens', { token })
    if (!tokenRow) {
      res.status(400).send({ reason: 'bad token' })
      return
    }

    // tokenRow.user_id is the account id here.
    // TODO: clean this up.. users vs accounts vs user_identity

    const account = await Users.getAccount(db, { id: tokenRow.user_id })
    if (!account) {
      res.status(400).send({ reason: 'bad account' })
      return
    }

    const identity = await Users.getIdentity(db, {
      provider_name: 'local',
      provider_id: account.id,
    })
    if (!identity) {
      res.status(400).send({ reason: 'bad identity' })
      return
    }

    // set account to verified
    await db.update('accounts', { status: 'verified' }, { id: account.id })

    // make the user logged in and redirect to startpage
    await addAuthToken(db, identity.user_id, res)

    // TODO: add parameter/hash so that user will get a message 'thanks for verifying the email'
    res.redirect(302, '/')
  })

  router.post('/logout', async (req: any, res): Promise<void> => {
    if (!req.token) {
      res.status(401).send({})
      return
    }
    await db.delete('tokens', { token: req.token })
    res.clearCookie(COOKIE_TOKEN)
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
      images: await Images.imagesFromDb(db, tagSlugs, q.sort, false, 0, IMAGES_PER_PAGE_LIMIT),
      tags: await Images.getAllTags(db),
    })
  })

  router.get('/artist/:name', async (req, res): Promise<void> => {
    const name = req.params.name
    const artist = await db.get('artist', { name })
    if (!artist) {
      res.status(404).send({ reason: 'not found' })
      return
    }
    const rel1 = await db.getMany('artist_x_collection', { artist_id: artist.id })
    const collections = await db.getMany('collection', { id: { '$in': rel1.map((r: any) => r.collection_id )}})
    const rel2 = await db.getMany('collection_x_image', { collection_id: { '$in': collections.map((r: any) => r.id )}})
    const images = await Images.imagesByIdsFromDb(db, rel2.map((r: any) => r.image_id ))
    collections.forEach(c => {
      c.images = images.filter(image => rel2.find(r => r.collection_id === c.id && r.image_id === image.id) ? true : false)
    })
    res.send({
      artist,
      collections,
    })
  })

  router.get('/images', async (req, res): Promise<void> => {
    const q: Record<string, any> = req.query
    const tagSlugs: string[] = q.tags ? q.tags.split(',') : []
    const offset = parseInt(`${q.offset}`, 10)
    if (isNaN(offset) || offset < 0) {
      res.status(400).send({ error: 'bad offset' })
      return
    }
    res.send({
      images: await Images.imagesFromDb(db, tagSlugs, q.sort, false, offset, IMAGES_PER_PAGE_LIMIT),
    })
  })

  const GameToGameInfo = (game: GameType, ts: number): GameInfo => {
    const finished = GameCommon.Game_getFinishTs(game)
    return {
      id: game.id,
      hasReplay: GameLog.hasReplay(game),
      started: GameCommon.Game_getStartTs(game),
      finished,
      piecesFinished: GameCommon.Game_getFinishedPiecesCount(game),
      piecesTotal: GameCommon.Game_getPieceCount(game),
      players: finished
        ? GameCommon.Game_getPlayersWithScore(game).length
        : GameCommon.Game_getActivePlayers(game, ts).length,
      imageUrl: GameCommon.Game_getImageUrl(game),
      snapMode: GameCommon.Game_getSnapMode(game),
      scoreMode: GameCommon.Game_getScoreMode(game),
      shapeMode: GameCommon.Game_getShapeMode(game),
    }
  }

  router.get('/index-data', async (req, res): Promise<void> => {
    const ts = Time.timestamp()
    // all running rows
    const runningRows = await GameStorage.getPublicRunningGames(db, -1, -1)
    const runningCount = await GameStorage.countPublicRunningGames(db)
    const finishedRows = await GameStorage.getPublicFinishedGames(db, 0, GAMES_PER_PAGE_LIMIT)
    const finishedCount = await GameStorage.countPublicFinishedGames(db)

    const gamesRunning: GameInfo[] = runningRows.map((v) => GameToGameInfo(v, ts))
    const gamesFinished: GameInfo[] = finishedRows.map((v) => GameToGameInfo(v, ts))

    const indexData: ApiDataIndexData = {
      gamesRunning: {
        items: gamesRunning,
        pagination: { total: runningCount, offset: 0, limit: 0 }
      },
      gamesFinished: {
        items: gamesFinished,
        pagination: { total: finishedCount, offset: 0, limit: GAMES_PER_PAGE_LIMIT }
      },
    }
    res.send(indexData)
  })

  router.get('/finished-games', async (req, res): Promise<void> => {
    const offset = parseInt(`${req.query.offset}`, 10)
    if (isNaN(offset) || offset < 0) {
      res.status(400).send({ error: 'bad offset' })
      return
    }
    const ts = Time.timestamp()
    const finishedRows = await GameStorage.getPublicFinishedGames(db, offset, GAMES_PER_PAGE_LIMIT)
    const finishedCount = await GameStorage.countPublicFinishedGames(db)
    const gamesFinished: GameInfo[] = finishedRows.map((v) => GameToGameInfo(v, ts))
    const indexData: ApiDataFinishedGames = {
      items: gamesFinished,
      pagination: { total: finishedCount, offset: offset, limit: GAMES_PER_PAGE_LIMIT }
    }
    res.send(indexData)
  })

  router.post('/save-image', express.json(), async (req: any, res): Promise<void> => {
    const user = req.user || null
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

    res.send({ ok: true, image: await Images.imageFromDb(db, data.id) })
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

      const user = await Users.getOrCreateUserByRequest(db, req)

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

  router.get('/announcements', async (req, res) => {
    const items = await db.getMany('announcements', undefined, [{ created: -1 }])
    res.send(items)
  })

  router.post('/newgame', express.json(), async (req, res): Promise<void> => {
    const user = await Users.getOrCreateUserByRequest(db, req)
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
