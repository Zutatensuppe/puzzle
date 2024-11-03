import { GameSettings, GameInfo, ApiDataIndexData, ApiDataFinishedGames, NewGameDataRequestData, ImagesRequestData, UserId, ImageId, ClientId, UserRow } from '../../../../common/src/Types'
import config from '../../Config'
import express, { Response, Router } from 'express'
import GameLog from '../../GameLog'
import multer from 'multer'
import request from 'request'
import Time from '../../../../common/src/Time'
import Util, { logger, uniqId } from '../../../../common/src/Util'
import { COOKIE_TOKEN, generateSalt, generateToken, passwordHash } from '../../Auth'
import { Server } from '../../Server'
import fs from '../../FileSystem'

const log = logger('web_routes/api/index.ts')

interface SaveImageRequestData {
  id: ImageId
  title: string
  copyrightName: string
  copyrightURL: string
  tags: string[]
}
const GAMES_PER_PAGE_LIMIT = 10
const IMAGES_PER_PAGE_LIMIT = 20

export default function createRouter(
  server: Server,
): Router {

  const determineNewUserClientId = async (originalClientId: ClientId): Promise<ClientId> => {
    // if a client id is given, we will use it, if it doesnt
    // correspond to a registered user. this way, guests will
    // continue to have their client id after logging in.
    // this will make them show up on leaderboards and keep scores in
    // puzzles they have puzzled as guests
    return originalClientId && !await server.users.clientIdTaken(originalClientId)
      ? originalClientId
      : uniqId() as ClientId
  }

  const addAuthToken = async (userId: UserId, res: Response): Promise<void> => {
    const token = await server.users.addAuthToken(userId)
    res.cookie(COOKIE_TOKEN, token, { maxAge: 356 * Time.DAY, httpOnly: true })
  }

  const basename = (file: Express.Multer.File) => {
    return `${Util.uniqId()}-${Util.hash(file.originalname)}`
  }

  const extension = (file: Express.Multer.File) => {
    switch (file.mimetype) {
      case 'image/png': return '.png'
      case 'image/jpeg': return '.jpeg'
      case 'image/webp': return '.webp'
      case 'image/gif': return '.gif'
      case 'image/svg+xml': return '.svg'
      default: {
        // try to keep original filename
        const m = file.filename.match(/\.[a-z]+$/)
        return m ? m[0] : '.unknown'
      }
    }
  }

  const storage = multer.diskStorage({
    destination: config.dir.UPLOAD_DIR,
    filename: function (req, file, cb) {
      cb(null, `${basename(file)}${extension(file)}`)
    },
  })
  const upload = multer({ storage }).single('file')

  const router = express.Router()
  router.get('/me', async (req: any, res): Promise<void> => {
    if (req.user) {
      const groups = await server.users.getGroups(req.user.id)
      res.send({
        id: req.user.id,
        name: req.user.name,
        clientId: req.user.client_id,
        created: req.user.created,
        type: req.user_type,
        cannyToken: server.canny.createToken(req.user),
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
      redirect_uri: '',
    }
    const redirectUris = [
      `${config.http.publicBaseUrl}/api/auth/twitch/redirect_uri`,
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
        },
      })
      if (!userRes.ok) {
        continue
      }

      const userData = await userRes.json()
      const provider_name = 'twitch'
      const provider_id = userData.data[0].id
      const provider_email = userData.data[0].email

      const identity = await server.users.getIdentity({
        provider_name,
        provider_id,
      })

      // in the auth/twitch request, no client_id header is sent, so we also
      // cannot use req.user
      // instead, the client_id is passed via req.query.state (but it can be empty)
      const client_id = req.query.state || ''
      // first try to find user by the identity
      // the client_id should only be used if no identity is found
      let user: UserRow | null = null
      if (identity) {
        user = await server.users.getUserByIdentity(identity)
      }
      if (!user) {
        user = await server.users.getUser({ client_id })
      }
      if (!user) {
        user = await server.users.createUser({
          client_id: await determineNewUserClientId(client_id),
          created: new Date(),
          email: provider_email,
          name: userData.data[0].display_name,
        })
      } else {
        let updateNeeded = false
        if (!user.name) {
          user.name = userData.data[0].display_name
          updateNeeded = true
        }
        if (!user.email) {
          user.email = provider_email
          updateNeeded = true
        }
        if (updateNeeded) {
          await server.users.updateUser(user)
        }
      }

      if (!identity) {
        await server.users.createIdentity({
          user_id: user.id,
          provider_name,
          provider_id,
          provider_email,
        })
      } else {
        let updateNeeded = false
        if (identity.user_id !== user.id) {
          // maybe we do not have to do this
          identity.user_id = user.id
          updateNeeded = true
        }
        if (!identity.provider_email) {
          identity.provider_email = provider_email
          updateNeeded = true
        }
        if (updateNeeded) {
          await server.users.updateIdentity(identity)
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
    const account = await server.users.getAccountByEmailPlain(emailPlain)
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
    const identity = await server.users.getIdentity({
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

    const tokenRow = await server.repos.tokens.get({ type: 'password-reset', token })

    if (!tokenRow) {
      res.status(400).send({ reason: 'no such token' })
      return
    }

    // note: token contains account id, not user id ...
    const account = await server.users.getAccount({ id: tokenRow.user_id })
    if (!account) {
      res.status(400).send({ reason: 'no such account' })
      return
    }

    const password = passwordHash(passwordRaw, account.salt)
    account.password = password
    await server.users.updateAccount(account)

    // remove token, already used
    await server.repos.tokens.delete(tokenRow)

    res.send({ success: true })
  })

  router.post('/send-password-reset-email', express.json(), async (req: any, res): Promise<void> => {
    // we always respond with success, so that the user cannot
    // as easily guess if an email is registered or not

    const emailPlain = `${req.body.email}`
    const account = await server.users.getAccountByEmailPlain(emailPlain)
    if (!account) {
      // res.status(400).send({ reason: 'no such email' })
      res.send({ success: true })
      return
    }
    const identity = await server.users.getIdentity({
      provider_name: 'local',
      provider_id: account.id,
    })
    if (!identity) {
      // res.status(400).send({ reason: 'no such identity' })
      res.send({ success: true })
      return
    }
    const user = await server.users.getUser({
      id: identity.user_id,
    })
    if (!user) {
      // res.status(400).send({ reason: 'no such user' })
      res.send({ success: true })
      return
    }

    const token = generateToken()
    // TODO: dont misuse token table user id <> account id
    const tokenRow = {
      user_id: account.id,
      token,
      type: 'password-reset',
    }
    await server.repos.tokens.insert(tokenRow)
    server.mail.sendPasswordResetMail({ user: { name: user.name, email: emailPlain }, token: tokenRow })
    res.send({ success: true })
  })

  router.post('/register', express.json(), async (req: any, res): Promise<void> => {
    const salt = generateSalt()

    const client_id = await determineNewUserClientId(req.user ? req.user.client_id : '')

    const emailRaw = `${req.body.email}`
    const passwordRaw = `${req.body.password}`
    const usernameRaw = `${req.body.username}`

    if (await server.users.usernameTaken(usernameRaw)) {
      res.status(409).send({ reason: 'username already taken' })
      return
    }

    if (await server.users.emailTaken(emailRaw)) {
      res.status(409).send({ reason: 'email already taken' })
      return
    }

    const account = await server.users.createAccount({
      created: new Date(),
      email: emailRaw,
      password: passwordHash(passwordRaw, salt),
      salt: salt,
      status: 'verification_pending',
    })

    let user = await server.users.getUser({ client_id })
    if (user) {
      // update user
      user.email = emailRaw
      user.name = usernameRaw
      await server.users.updateUser(user)
    } else {
      user = await server.users.createUser({
        client_id,
        created: new Date(),
        email: emailRaw,
        name: usernameRaw,
      })
    }

    await server.users.createIdentity({
      user_id: user.id,
      provider_name: 'local',
      provider_id: `${account.id}`,
      provider_email: null,
    })

    const userInfo = { email: emailRaw, name: usernameRaw }
    const token = generateToken()
    const tokenRow = {
      user_id: account.id,
      token,
      type: 'registration',
    }
    // TODO: dont misuse token table user id <> account id
    await server.repos.tokens.insert(tokenRow)
    server.mail.sendRegistrationMail({ user: userInfo, token: tokenRow })
    res.send({ success: true })
  })

  router.get('/verify-email/:token', async (req, res): Promise<void> => {
    const token = req.params.token
    const tokenRow = await server.repos.tokens.get({ token })
    if (!tokenRow) {
      res.status(400).send({ reason: 'bad token' })
      return
    }

    // tokenRow.user_id is the account id here.
    // TODO: clean this up.. users vs accounts vs user_identity

    const account = await server.users.getAccount({ id: tokenRow.user_id })
    if (!account) {
      res.status(400).send({ reason: 'bad account' })
      return
    }

    const identity = await server.users.getIdentity({
      provider_name: 'local',
      provider_id: account.id,
    })
    if (!identity) {
      res.status(400).send({ reason: 'bad identity' })
      return
    }

    // set account to verified
    await server.users.setAccountVerified(account.id)

    // make the user logged in and redirect to startpage
    await addAuthToken(identity.user_id, res)

    res.redirect(302, '/#email-verified=true')
  })

  router.post('/logout', async (req: any, res): Promise<void> => {
    if (!req.token) {
      res.status(401).send({})
      return
    }
    await server.repos.tokens.delete({ token: req.token })
    res.clearCookie(COOKIE_TOKEN)
    res.send({ success: true })
  })

  router.get('/conf', (_req, res): void => {
    res.send({
      WS_ADDRESS: config.ws.connectstring,
    })
  })

  router.get('/replay-game-data', async (req, res): Promise<void> => {
    const q: Record<string, any> = req.query
    const gameId = q.gameId || ''
    if (!await GameLog.exists(q.gameId)) {
      res.status(404).send({ reason: 'no log found' })
      return
    }
    const gameObj = await server.gameService.createNewGameObjForReplay(gameId)
    if (!gameObj) {
      res.status(404).send({ reason: 'no game found' })
      return
    }
    res.send({ game: Util.encodeGame(gameObj) })
  })

  router.get('/replay-log-data', async (req, res): Promise<void> => {
    const q: Record<string, any> = req.query
    const logFileIdx = parseInt(q.logFileIdx, 10) || 0
    if (logFileIdx < 0) {
      res.status(400).send({ reason: 'bad logFileIdx' })
      return
    }
    const gameId = q.gameId || ''
    const idxObj = await GameLog.getIndex(q.gameId)
    if (!idxObj) {
      res.status(404).send({ reason: 'no log found' })
      return
    }
    const offset = idxObj.perFile * logFileIdx
    const f = await GameLog.gzFilenameOrFilename(gameId, offset)
    if (!f) {
      res.send('')
      return
    }

    res.header('Content-Type', 'text/plain')
    if (f.endsWith('.gz')) {
      res.header('Content-Encoding', 'gzip')
    }
    res.send(await fs.readFileRaw(f))
  })

  router.get('/newgame-data', async (req: any, res): Promise<void> => {
    const user: UserRow | null = req.user || null
    const userId = user && req.user_type === 'user' ? user.id : 0 as UserId

    const requestData: NewGameDataRequestData = req.query as any
    res.send({
      images: await server.images.imagesFromDb(requestData.search, requestData.sort, false, 0, IMAGES_PER_PAGE_LIMIT, userId),
      tags: await server.images.getAllTags(),
    })
  })

  router.get('/artist/:name', async (req, res): Promise<void> => {
    const name = req.params.name
    const artist = await server.db.get('artist', { name })
    if (!artist) {
      res.status(404).send({ reason: 'not found' })
      return
    }
    const rel1 = await server.db.getMany('artist_x_collection', { artist_id: artist.id })
    const collections = await server.db.getMany('collection', { id: { '$in': rel1.map((r: any) => r.collection_id) } })
    const rel2 = await server.db.getMany('collection_x_image', { collection_id: { '$in': collections.map((r: any) => r.id) } })
    const items = await server.images.imagesByIdsFromDb(rel2.map((r: any) => r.image_id))
    for (const c of collections) {
      c.images = items.filter(image => rel2.find(r => r.collection_id === c.id && r.image_id === image.id) ? true : false)
    }
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
    const userId = user && req.user_type === 'user' ? user.id : 0 as UserId

    res.send({
      images: await server.images.imagesFromDb(requestData.search, requestData.sort, false, offset, IMAGES_PER_PAGE_LIMIT, userId),
    })
  })

  router.get('/index-data', async (req: any, res): Promise<void> => {
    const user: UserRow | null = req.user || null
    const userId = user && req.user_type === 'user' ? user.id : 0 as UserId

    const ts = Time.timestamp()
    // all running rows
    const runningRows = await server.gameService.getPublicRunningGames(-1, -1, userId)
    const runningCount = await server.gameService.countPublicRunningGames(userId)
    const finishedRows = await server.gameService.getPublicFinishedGames(0, GAMES_PER_PAGE_LIMIT, userId)
    const finishedCount = await server.gameService.countPublicFinishedGames(userId)

    const gamesRunning: GameInfo[] = []
    const gamesFinished: GameInfo[] = []
    for (const row of runningRows) {
      gamesRunning.push(await server.gameService.gameToGameInfo(row, ts))
    }
    for (const row of finishedRows) {
      gamesFinished.push(await server.gameService.gameToGameInfo(row, ts))
    }

    const leaderboards = await server.repos.leaderboard.getTop10(userId)

    const livestreams = await server.repos.livestreams.getLive()

    const indexData: ApiDataIndexData = {
      gamesRunning: {
        items: gamesRunning,
        pagination: { total: runningCount, offset: 0, limit: 0 },
      },
      gamesFinished: {
        items: gamesFinished,
        pagination: { total: finishedCount, offset: 0, limit: GAMES_PER_PAGE_LIMIT },
      },
      leaderboards,
      livestreams,
    }
    res.send(indexData)
  })

  router.get('/finished-games', async (req: any, res): Promise<void> => {
    const user: UserRow | null = req.user || null
    const userId = user && req.user_type === 'user' ? user.id : 0 as UserId

    const offset = parseInt(`${req.query.offset}`, 10)
    if (isNaN(offset) || offset < 0) {
      res.status(400).send({ error: 'bad offset' })
      return
    }
    const ts = Time.timestamp()
    const finishedRows = await server.gameService.getPublicFinishedGames(offset, GAMES_PER_PAGE_LIMIT, userId)
    const finishedCount = await server.gameService.countPublicFinishedGames(userId)
    const gamesFinished: GameInfo[] = []
    for (const row of finishedRows) {
      gamesFinished.push(await server.gameService.gameToGameInfo(row, ts))
    }
    const indexData: ApiDataFinishedGames = {
      items: gamesFinished,
      pagination: { total: finishedCount, offset: offset, limit: GAMES_PER_PAGE_LIMIT },
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
    const image = await server.images.getImageById(data.id)
    if (!image) {
      res.status(404).send({ ok: false, error: 'not_found' })
      return
    }

    if (image.uploader_user_id !== user.id) {
      res.status(403).send({ ok: false, error: 'forbidden' })
      return
    }

    await server.images.updateImage({
      title: data.title,
      copyright_name: data.copyrightName,
      copyright_url: server.urlUtil.fixUrl(data.copyrightURL || ''),
    }, { id: data.id })

    await server.images.setTags(data.id, data.tags || [])

    res.send({ ok: true, image: await server.images.imageFromDb(data.id) })
  })

  router.get('/proxy', (req: any, res): void => {
    log.info('proxy request for url:', req.query.url)
    request(req.query.url).on('error', (e) => {
      log.error(e)
      res.status(400).send({ ok: false })
    }).pipe(res).on('error', (e) => {
      log.error(e)
      res.status(400).send({ ok: false })
    })
  })

  router.post('/upload', (req: any, res): void => {
    void upload(req, res, async (err: any): Promise<void> => {
      if (err) {
        log.log('/api/upload/', 'error', err)
        res.status(400).send('Something went wrong!')
        return
      }

      log.info('req.file.filename', req.file.filename)

      const im = server.images

      const user = await server.users.getOrCreateUserByRequest(req)

      const dim = await im.getDimensions(
        `${config.dir.UPLOAD_DIR}/${req.file.filename}`,
      )
      // post form, so booleans are submitted as 'true' | 'false'
      const isPrivate = req.body.private === 'false' ? 0 : 1
      const imageId = await im.insertImage({
        uploader_user_id: user.id,
        filename: req.file.filename,
        filename_original: req.file.originalname,
        title: req.body.title || '',
        copyright_name: req.body.copyrightName || '',
        copyright_url: server.urlUtil.fixUrl(req.body.copyrightURL || ''),
        created: new Date(),
        width: dim.w,
        height: dim.h,
        private: isPrivate,
      })

      if (req.body.tags) {
        const tags = req.body.tags.split(',').filter((tag: string) => !!tag)
        await im.setTags(imageId, tags)
      }

      res.send(await im.imageFromDb(imageId))
    })
  })

  router.get('/announcements', async (req, res) => {
    const items = await server.repos.announcements.getAll()
    res.send(items)
  })

  router.post('/newgame', express.json(), async (req, res): Promise<void> => {
    const user = await server.users.getOrCreateUserByRequest(req)
    try {
      const gameId = await server.gameService.createNewGame(
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
