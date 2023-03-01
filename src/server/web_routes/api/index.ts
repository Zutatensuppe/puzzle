import { GameSettings, Game as GameType, GameInfo, ApiDataIndexData, ApiDataFinishedGames, NewGameDataRequestData, ImagesRequestData } from '../../../common/Types'
import config from '../../Config'
import express, { Response, Router } from 'express'
import GameCommon from '../../../common/GameCommon'
import GameLog from '../../GameLog'
import multer from 'multer'
import request from 'request'
import Time from '../../../common/Time'
import Util, { logger, uniqId } from '../../../common/Util'
import { COOKIE_TOKEN, generateSalt, generateToken, passwordHash } from '../../Auth'
import { ServerInterface } from '../../Server'
import { UserRow } from '../../repo/UsersRepo'

const log = logger('web_routes/api/index.ts')

interface SaveImageRequestData {
  id: number
  title: string
  copyrightName: string
  copyrightURL: string
  tags: string[]
}
const GAMES_PER_PAGE_LIMIT = 10
const IMAGES_PER_PAGE_LIMIT = 20

export default function createRouter(
  server: ServerInterface,
): Router {

  const addAuthToken = async (userId: number, res: Response): Promise<void> => {
    const token = await server.getUsers().addAuthToken(userId)
    res.cookie(COOKIE_TOKEN, token, { maxAge: 356 * Time.DAY, httpOnly: true })
  }

  const storage = multer.diskStorage({
    destination: config.dir.UPLOAD_DIR,
    filename: function (req, file, cb) {
      cb(null , `${Util.uniqId()}-${file.originalname}`)
    }
  })
  const upload = multer({storage}).single('file')

  const router = express.Router()
  router.get('/me', async (req: any, res): Promise<void> => {
    if (req.user) {
      const groups = await server.getUsers().getGroups(req.user.id)
      res.send({
        id: req.user.id,
        name: req.user.name,
        clientId: req.user.client_id,
        created: req.user.created,
        type: req.user_type,
        cannyToken: server.getCanny().createToken(req.user),
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

      const identity = await server.getUsers().getIdentity({
        provider_name: 'twitch',
        provider_id: userData.data[0].id,
      })

      let user = null
      if (req.user) {
        user = req.user
      } else if (identity) {
        user = await server.getUsers().getUserByIdentity(identity)
      }

      if (!user) {
        user = await server.getUsers().createUser({
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
          await server.getUsers().updateUser(user)
        }
      }

      if (!identity) {
        server.getUsers().createIdentity({
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
          server.getUsers().updateIdentity(identity)
        }
      }

      await addAuthToken(user.id, res)
      res.send('<html><script>window.opener.handleAuthCallback();window.close();</script></html>')
      return
    }

    res.status(403).send({ reason: req.query })
  })

  // login via email + password
  router.post('/auth/local', express.json(), async (req, res): Promise<void> => {
    const emailPlain = req.body.email
    const passwordPlain = req.body.password
    const account = await server.getUsers().getAccount({ email: emailPlain })
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
    const identity = await server.getUsers().getIdentity({
      provider_name: 'local',
      provider_id: account.id,
    })
    if (!identity) {
      res.status(401).send({ reason: 'no identity' })
      return
    }

    await addAuthToken(identity.user_id, res)
    res.send({ success: true })
  })

  router.post('/change-password', express.json(), async (req: any, res): Promise<void> => {
    const token = `${req.body.token}`
    const passwordRaw = `${req.body.password}`

    const tokenRow = await server.getTokensRepo().get({ type: 'password-reset', token })

    if (!tokenRow) {
      res.status(400).send({ reason: 'no such token' })
      return
    }

    // note: token contains account id, not user id ...
    const account = await server.getUsers().getAccount({ id: tokenRow.user_id })
    if (!account) {
      res.status(400).send({ reason: 'no such account' })
      return
    }

    const password = passwordHash(passwordRaw, account.salt)
    account.password = password
    await server.getUsers().updateAccount(account)

    // remove token, already used
    await server.getTokensRepo().delete(tokenRow)

    res.send({ success: true })
  })

  router.post('/send-password-reset-email', express.json(), async (req: any, res): Promise<void> => {
    const emailRaw = `${req.body.email}`

    const account = await server.getUsers().getAccount({ email: emailRaw })
    if (!account) {
      res.status(400).send({ reason: 'no such email' })
      return
    }
    const identity = await server.getUsers().getIdentity({
      provider_name: 'local',
      provider_id: account.id,
    })
    if (!identity) {
      res.status(400).send({ reason: 'no such identity' })
      return
    }
    const user = await server.getUsers().getUser({
      id: identity.user_id,
    })
    if (!user) {
      res.status(400).send({ reason: 'no such user' })
      return
    }

    const token = generateToken()
    // TODO: dont misuse token table user id <> account id
    const tokenRow = { user_id: account.id, token, type: 'password-reset' }
    await server.getTokensRepo().insert(tokenRow)
    server.getMail().sendPasswordResetMail({ user: { name: user.name, email: emailRaw }, token: tokenRow })
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

    const account = await server.getUsers().createAccount({
      created: new Date(),
      email: emailRaw,
      password: passwordHash(passwordRaw, salt),
      salt: salt,
      status: 'verification_pending',
    })

    const user = await server.getUsers().createUser({
      created: new Date(),
      name: usernameRaw,
      email: emailRaw,
      client_id: uniqId(),
    })

    await server.getUsers().createIdentity({
      user_id: user.id,
      provider_name: 'local',
      provider_id: account.id,
    })

    const userInfo = { email: emailRaw, name: usernameRaw }
    const token = generateToken()
    const tokenRow = { user_id: account.id, token, type: 'registration' }
    await server.getTokensRepo().insert(tokenRow)
    server.getMail().sendRegistrationMail({ user: userInfo, token: tokenRow })
    res.send({ success: true })
  })

  router.get('/verify-email/:token', async (req, res): Promise<void> => {
    const token = req.params.token
    const tokenRow = await server.getTokensRepo().get({ token })
    if (!tokenRow) {
      res.status(400).send({ reason: 'bad token' })
      return
    }

    // tokenRow.user_id is the account id here.
    // TODO: clean this up.. users vs accounts vs user_identity

    const account = await server.getUsers().getAccount({ id: tokenRow.user_id })
    if (!account) {
      res.status(400).send({ reason: 'bad account' })
      return
    }

    const identity = await server.getUsers().getIdentity({
      provider_name: 'local',
      provider_id: account.id,
    })
    if (!identity) {
      res.status(400).send({ reason: 'bad identity' })
      return
    }

    // set account to verified
    await server.getUsers().setAccountVerified(account.id)

    // make the user logged in and redirect to startpage
    await addAuthToken(identity.user_id, res)

    // TODO: add parameter/hash so that user will get a message 'thanks for verifying the email'
    res.redirect(302, '/')
  })

  router.post('/logout', async (req: any, res): Promise<void> => {
    if (!req.token) {
      res.status(401).send({})
      return
    }
    await server.getTokensRepo().delete({ token: req.token })
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
      game = await server.getGameService().createGameObject(
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
        log[0][10], // crop
      )
      game.puzzle.info.image.gameCount = await server.getImagesRepo().getGameCount(game.puzzle.info.image.id)
    }
    res.send({ log, game: game ? Util.encodeGame(game) : null })
  })

  router.get('/newgame-data', async (req: any, res): Promise<void> => {
    const user: UserRow | null = req.user || null
    const userId = user && req.user_type === 'user' ? user.id : 0

    const requestData: NewGameDataRequestData = req.query as any
    res.send({
      images: await server.getImages().imagesFromDb(requestData.search, requestData.sort, false, 0, IMAGES_PER_PAGE_LIMIT, userId),
      tags: await server.getImages().getAllTags(),
    })
  })

  router.get('/artist/:name', async (req, res): Promise<void> => {
    const name = req.params.name
    const artist = await server.getDb().get('artist', { name })
    if (!artist) {
      res.status(404).send({ reason: 'not found' })
      return
    }
    const rel1 = await server.getDb().getMany('artist_x_collection', { artist_id: artist.id })
    const collections = await server.getDb().getMany('collection', { id: { '$in': rel1.map((r: any) => r.collection_id )}})
    const rel2 = await server.getDb().getMany('collection_x_image', { collection_id: { '$in': collections.map((r: any) => r.id )}})
    const items = await server.getImages().imagesByIdsFromDb(rel2.map((r: any) => r.image_id ))
    collections.forEach(c => {
      c.images = items.filter(image => rel2.find(r => r.collection_id === c.id && r.image_id === image.id) ? true : false)
    })
    res.send({
      artist,
      collections,
    })
  })

  router.get('/images', async (req: any, res): Promise<void> => {
    const requestData: ImagesRequestData = req.query as any
    const offset = parseInt(`${requestData.offset}`, 10)
    if (isNaN(offset) || offset < 0) {
      res.status(400).send({ error: 'bad offset' })
      return
    }
    const user: UserRow | null = req.user || null
    const userId = user && req.user_type === 'user' ? user.id : 0

    res.send({
      images: await server.getImages().imagesFromDb(requestData.search, requestData.sort, false, offset, IMAGES_PER_PAGE_LIMIT, userId),
    })
  })

  const GameToGameInfo = (game: GameType, ts: number): GameInfo => {
    const finished = GameCommon.Game_getFinishTs(game)
    return {
      id: game.id,
      hasReplay: GameLog.hasReplay(game),
      isPrivate: GameCommon.Game_isPrivate(game),
      started: GameCommon.Game_getStartTs(game),
      finished,
      piecesFinished: GameCommon.Game_getFinishedPiecesCount(game),
      piecesTotal: GameCommon.Game_getPieceCount(game),
      players: finished
        ? GameCommon.Game_getPlayersWithScore(game).length
        : GameCommon.Game_getActivePlayers(game, ts).length,
      image: GameCommon.Game_getImage(game),
      snapMode: GameCommon.Game_getSnapMode(game),
      scoreMode: GameCommon.Game_getScoreMode(game),
      shapeMode: GameCommon.Game_getShapeMode(game),
    }
  }

  router.get('/index-data', async (req: any, res): Promise<void> => {
    const user: UserRow | null = req.user || null
    const userId = user && req.user_type === 'user' ? user.id : 0

    const ts = Time.timestamp()
    // all running rows
    const runningRows = await server.getGameService().getPublicRunningGames(-1, -1, userId)
    const runningCount = await server.getGameService().countPublicRunningGames(userId)
    const finishedRows = await server.getGameService().getPublicFinishedGames(0, GAMES_PER_PAGE_LIMIT, userId)
    const finishedCount = await server.getGameService().countPublicFinishedGames(userId)

    const gamesRunning: GameInfo[] = runningRows.map((v) => GameToGameInfo(v, ts))
    const gamesFinished: GameInfo[] = finishedRows.map((v) => GameToGameInfo(v, ts))

    const leaderboards = await server.getLeaderboardRepo().getTop10(userId)

    const indexData: ApiDataIndexData = {
      gamesRunning: {
        items: gamesRunning,
        pagination: { total: runningCount, offset: 0, limit: 0 }
      },
      gamesFinished: {
        items: gamesFinished,
        pagination: { total: finishedCount, offset: 0, limit: GAMES_PER_PAGE_LIMIT }
      },
      leaderboards,
    }
    res.send(indexData)
  })

  router.get('/finished-games', async (req: any, res): Promise<void> => {
    const user: UserRow | null = req.user || null
    const userId = user && req.user_type === 'user' ? user.id : 0

    const offset = parseInt(`${req.query.offset}`, 10)
    if (isNaN(offset) || offset < 0) {
      res.status(400).send({ error: 'bad offset' })
      return
    }
    const ts = Time.timestamp()
    const finishedRows = await server.getGameService().getPublicFinishedGames(offset, GAMES_PER_PAGE_LIMIT, userId)
    const finishedCount = await server.getGameService().countPublicFinishedGames(userId)
    const gamesFinished: GameInfo[] = finishedRows.map((v) => GameToGameInfo(v, ts))
    const indexData: ApiDataFinishedGames = {
      items: gamesFinished,
      pagination: { total: finishedCount, offset: offset, limit: GAMES_PER_PAGE_LIMIT }
    }
    res.send(indexData)
  })

  router.post('/save-image', express.json(), async (req: any, res): Promise<void> => {
    const user: UserRow | null = req.user || null
    if (!user || !user.id) {
      res.status(403).send({ ok: false, error: 'forbidden' })
      return
    }

    const data = req.body as SaveImageRequestData
    const image = await server.getImages().getImageById(data.id)
    if (!image) {
      res.status(404).send({ ok: false, error: 'not_found' })
      return
    }

    if (image.uploader_user_id !== user.id) {
      res.status(403).send({ ok: false, error: 'forbidden' })
      return
    }

    await server.getImages().updateImage({
      title: data.title,
      copyright_name: data.copyrightName,
      copyright_url: data.copyrightURL,
    }, { id: data.id })

    await server.getImages().setTags(data.id, data.tags || [])

    res.send({ ok: true, image: await server.getImages().imageFromDb(data.id) })
  })

  router.get('/proxy', (req: any, res): void => {
    log.info('proxy request for url:', req.query.url)
    request(req.query.url).pipe(res)
  })

  router.post('/upload', (req: any, res): void => {
    upload(req, res, async (err: any): Promise<void> => {
      if (err) {
        log.log('/api/upload/', 'error', err)
        res.status(400).send('Something went wrong!')
        return
      }

      log.info('req.file.filename', req.file.filename)

      const user = await server.getUsers().getOrCreateUserByRequest(req)

      const dim = await server.getImages().getDimensions(
        `${config.dir.UPLOAD_DIR}/${req.file.filename}`
      )
      // post form, so booleans are submitted as 'true' | 'false'
      const isPrivate = req.body.private === 'false' ? 0 : 1
      const imageId = await server.getImages().insertImage({
        uploader_user_id: user.id,
        filename: req.file.filename,
        filename_original: req.file.originalname,
        title: req.body.title || '',
        copyright_name: req.body.copyrightName || '',
        copyright_url: req.body.copyrightURL || '',
        created: new Date(),
        width: dim.w,
        height: dim.h,
        private: isPrivate,
      })

      if (req.body.tags) {
        const tags = req.body.tags.split(',').filter((tag: string) => !!tag)
        await server.getImages().setTags(imageId as number, tags)
      }

      res.send(await server.getImages().imageFromDb(imageId as number))
    })
  })

  router.get('/announcements', async (req, res) => {
    const items = await server.getAnnouncementsRepo().getAll()
    res.send(items)
  })

  router.post('/newgame', express.json(), async (req, res): Promise<void> => {
    const user = await server.getUsers().getOrCreateUserByRequest(req)
    try {
      const gameId = await server.getGameService().createNewGame(
        req.body as GameSettings,
        Time.timestamp(),
        user.id,
      )
      res.send({ id: gameId })
    } catch (e: any) {
      log.error(e)
      res.status(400).send({ reason: e.message })
    }
  })
  return router
}
