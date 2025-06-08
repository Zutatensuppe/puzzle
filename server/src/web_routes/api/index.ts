import type {
  Api,
  GameSettings,
  GameInfo,
  UserId,
  ImageId,
  ClientId,
  UserRow,
  GameId,
} from '../../../../common/src/Types'
import config from '../../Config'
import express from 'express'
import GameLog from '../../GameLog'
import multer from 'multer'
import request from 'request'
import Time from '../../../../common/src/Time'
import Util, { isEncodedGameLegacy, logger, newJSONDateString, uniqId } from '../../../../common/src/Util'
import { COOKIE_TOKEN, generateSalt, generateToken, passwordHash } from '../../Auth'
import type { Server } from '../../Server'
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
): express.Router {

  const determineNewUserClientId = async (originalClientId: ClientId | ''): Promise<ClientId> => {
    // if a client id is given, we will use it, if it doesnt
    // correspond to a registered user. this way, guests will
    // continue to have their client id after logging in.
    // this will make them show up on leaderboards and keep scores in
    // puzzles they have puzzled as guests
    return originalClientId && !await server.users.clientIdTaken(originalClientId)
      ? originalClientId
      : uniqId() as ClientId
  }

  const addAuthToken = async (userId: UserId, res: express.Response): Promise<void> => {
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
  router.get('/me', async (req, res): Promise<void> => {
    if (req.userInfo?.user) {
      const user: UserRow = req.userInfo.user
      const groups = await server.users.getGroups(user.id)
      const responseData: Api.MeResponseData = {
        id: user.id,
        name: user.name,
        clientId: user.client_id,
        created: user.created,
        type: req.userInfo.user_type,
        cannyToken: server.canny.createToken(user),
        groups: groups.map(g => g.name),
      }
      res.send(responseData)
      return
    }

    const responseData: Api.MeResponseData = { reason: 'no user' }
    res.status(401).send(responseData)
    return
  })

  // login via twitch (callback url called from twitch after authentication)
  router.get('/auth/twitch/redirect_uri', async (req, res): Promise<void> => {
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
      const client_id = String(req.query.state || '') as ClientId
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
          // TODO: date gets converted to string automatically. fix this type hint
          // @ts-ignore
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
      const responseData: Api.AuthLocalResponseData = { reason: 'bad email' }
      res.status(401).send(responseData)
      return
    }
    if (account.status !== 'verified') {
      const responseData: Api.AuthLocalResponseData = { reason: 'email not verified' }
      res.status(401).send(responseData)
      return
    }
    const salt = account.salt
    const passHashed = passwordHash(passwordPlain, salt)
    if (account.password !== passHashed) {
      const responseData: Api.AuthLocalResponseData = { reason: 'bad password' }
      res.status(401).send(responseData)
      return
    }
    const identity = await server.users.getIdentity({
      provider_name: 'local',
      provider_id: account.id,
    })
    if (!identity) {
      const responseData: Api.AuthLocalResponseData = { reason: 'no identity' }
      res.status(401).send(responseData)
      return
    }

    await addAuthToken(identity.user_id, res)
    const responseData: Api.AuthLocalResponseData = { success: true }
    res.send(responseData)
  })

  router.post('/change-password', express.json(), async (req, res): Promise<void> => {
    const token = `${req.body.token}`
    const passwordRaw = `${req.body.password}`

    const tokenRow = await server.repos.tokens.get({ type: 'password-reset', token })

    if (!tokenRow) {
      const responseData: Api.ChangePasswordResponseData = { reason: 'no such token' }
      res.status(400).send(responseData)
      return
    }

    // note: token contains account id, not user id ...
    const account = await server.users.getAccount({ id: tokenRow.user_id })
    if (!account) {
      const responseData: Api.ChangePasswordResponseData = { reason: 'no such account' }
      res.status(400).send(responseData)
      return
    }

    const password = passwordHash(passwordRaw, account.salt)
    account.password = password
    await server.users.updateAccount(account)

    // remove token, already used
    await server.repos.tokens.delete(tokenRow)

    const responseData: Api.ChangePasswordResponseData = { success: true }
    res.send(responseData)
  })

  router.post('/send-password-reset-email', express.json(), async (req, res): Promise<void> => {

    const emailPlain = `${req.body.email}`
    const account = await server.users.getAccountByEmailPlain(emailPlain)
    if (!account) {
      const responseData: Api.SendPasswordResetEmailResponseData = { reason: 'an error occured' }
      res.send(responseData)
      return
    }
    const identity = await server.users.getIdentity({
      provider_name: 'local',
      provider_id: account.id,
    })
    if (!identity) {
      const responseData: Api.SendPasswordResetEmailResponseData = { reason: 'an error occured' }
      res.send(responseData)
      return
    }
    const user = await server.users.getUser({
      id: identity.user_id,
    })
    if (!user) {
      const responseData: Api.SendPasswordResetEmailResponseData = { reason: 'an error occured' }
      res.send(responseData)
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
    const responseData: Api.SendPasswordResetEmailResponseData = { success: true }
    res.send(responseData)
  })

  router.post('/register', express.json(), async (req, res): Promise<void> => {
    const salt = generateSalt()

    const client_id = await determineNewUserClientId(req.userInfo?.user ? req.userInfo.user.client_id : '')

    const emailRaw = `${req.body.email}`
    const passwordRaw = `${req.body.password}`
    const usernameRaw = `${req.body.username}`

    if (await server.users.usernameTaken(usernameRaw)) {
      const responseData: Api.RegisterResponseData = { reason: 'username already taken' }
      res.status(409).send(responseData)
      return
    }

    if (await server.users.emailTaken(emailRaw)) {
      const responseData: Api.RegisterResponseData = { reason: 'email already taken' }
      res.status(409).send(responseData)
      return
    }

    const account = await server.users.createAccount({
      created: newJSONDateString(),
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
        created: newJSONDateString(),
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
    const responseData: Api.RegisterResponseData = { success: true }
    res.send(responseData)
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

  router.post('/logout', async (req, res): Promise<void> => {
    if (!req.userInfo?.token) {
      const responseData: Api.LogoutResponseData = { reason: 'no token' }
      res.status(401).send(responseData)
      return
    }
    await server.repos.tokens.delete({ token: req.userInfo.token })
    res.clearCookie(COOKIE_TOKEN)
    const responseData: Api.LogoutResponseData = { success: true }
    res.send(responseData)
  })

  router.get('/conf', (_req, res): void => {
    const responseData: Api.ConfigResponseData = {
      WS_ADDRESS: config.ws.connectstring,
    }
    res.send(responseData)
  })

  router.get('/replay-game-data', async (req, res): Promise<void> => {
    const q: Record<string, any> = req.query
    const gameId = q.gameId || ''
    if (!await GameLog.exists(q.gameId)) {
      const responseData: Api.ReplayGameDataResponseData = { reason: 'no log found' }
      res.status(404).send(responseData)
      return
    }
    const gameObj = await server.gameService.createNewGameObjForReplay(gameId)
    if (!gameObj) {
      const responseData: Api.ReplayGameDataResponseData = { reason: 'no game found' }
      res.status(404).send(responseData)
      return
    }
    const game = Util.encodeGame(gameObj)
    if (isEncodedGameLegacy(game)) {
      const responseData: Api.ReplayGameDataResponseData = { reason: 'legacy game cannot be replayed' }
      res.status(404).send(responseData)
      return
    }

    const responseData: Api.ReplayGameDataResponseData = { game }
    res.send(responseData)
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

  router.get('/newgame-data', async (req, res): Promise<void> => {
    const userInfo = req.userInfo
    const userId = userInfo?.user_type === 'user' ? userInfo.user.id : 0 as UserId

    const requestData: Api.NewGameDataRequestData = req.query as any
    const responseData: Api.NewGameDataResponseData = {
      featured: await server.repos.featured.getManyWithCollections({}),
      images: await server.images.imagesFromDb(requestData.search, requestData.sort, false, 0, IMAGES_PER_PAGE_LIMIT, userId),
      tags: await server.images.getAllTags(),
    }
    res.send(responseData)
  })

  router.get('/featured/:type/:slug', async (req, res): Promise<void> => {
    const type = req.params.type
    const slug = req.params.slug
    try {
      const responseData: Api.FeaturedResponseData = {
        featured: await server.repos.featured.getWithCollections({ type, slug }),
      }
      res.send(responseData)
    } catch (e: unknown) {
      res.status(404).send({ reason: e instanceof Error ? e.message : String(e) })
    }
  })

  router.get('/featured-teasers', async (req, res): Promise<void> => {
    const responseData: Api.FeaturedTeasersResponseData = {
      featuredTeasers: await server.repos.featured.getActiveTeasers(),
    }
    res.send(responseData)
  })

  router.get('/images', async (req, res): Promise<void> => {
    const requestData: Api.ImagesRequestData = req.query as any
    const offset = parseInt(`${requestData.offset}`, 10)
    if (isNaN(offset) || offset < 0) {
      res.status(400).send({ error: 'bad offset' })
      return
    }
    const userId = req.userInfo?.user_type === 'user' ? req.userInfo.user.id : 0 as UserId

    const responseData: Api.ImagesResponseData = {
      images: await server.images.imagesFromDb(requestData.search, requestData.sort, false, offset, IMAGES_PER_PAGE_LIMIT, userId),
    }
    res.send(responseData)
  })

  router.get('/index-data', async (req, res): Promise<void> => {
    const userId = req.userInfo?.user_type === 'user' ? req.userInfo.user.id : 0 as UserId

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

    const responseData: Api.ApiDataIndexData = {
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
    res.send(responseData)
  })

  router.get('/finished-games', async (req, res): Promise<void> => {
    const userId = req.userInfo?.user_type === 'user' ? req.userInfo.user.id : 0 as UserId

    const offset = parseInt(`${req.query.offset}`, 10)
    if (isNaN(offset) || offset < 0) {
      const responseData: Api.FinishedGamesResponseData = { error: 'bad offset' }
      res.status(400).send(responseData)
      return
    }
    const ts = Time.timestamp()
    const finishedRows = await server.gameService.getPublicFinishedGames(offset, GAMES_PER_PAGE_LIMIT, userId)
    const finishedCount = await server.gameService.countPublicFinishedGames(userId)
    const gamesFinished: GameInfo[] = []
    for (const row of finishedRows) {
      gamesFinished.push(await server.gameService.gameToGameInfo(row, ts))
    }
    const responseData: Api.FinishedGamesResponseData = {
      items: gamesFinished,
      pagination: { total: finishedCount, offset: offset, limit: GAMES_PER_PAGE_LIMIT },
    }
    res.send(responseData)
  })

  router.post('/save-image', express.json(), async (req: express.Request, res): Promise<void> => {
    const user: UserRow | null = req.userInfo?.user || null
    if (!user || !user.id) {
      res.status(403).send({ ok: false, error: 'forbidden' })
      return
    }

    const data = req.body as SaveImageRequestData
    const imageRow = await server.images.getImageById(data.id)
    if (!imageRow) {
      res.status(404).send({ ok: false, error: 'not_found' })
      return
    }

    if (imageRow.uploader_user_id !== user.id) {
      res.status(403).send({ ok: false, error: 'forbidden' })
      return
    }

    await server.images.updateImage({
      title: data.title,
      copyright_name: data.copyrightName,
      copyright_url: server.urlUtil.fixUrl(data.copyrightURL || ''),
    }, { id: data.id })

    await server.images.setTags(data.id, data.tags || [])

    const imageInfo = await server.images.imageFromDb(data.id)
    if (!imageInfo) {
      res.status(404).send({ ok: false, error: 'not_found' })
      return
    }

    res.send({ ok: true, imageInfo })
  })

  router.get('/proxy', (req, res): void => {
    log.info('proxy request for url:', req.query.url)
    if (!req.query.url || typeof req.query.url !== 'string') {
      res.status(400).send({ ok: false })
      return
    }
    request(req.query.url).on('error', (e) => {
      log.error(e)
      res.status(400).send({ ok: false })
    }).pipe(res).on('error', (e) => {
      log.error(e)
      res.status(400).send({ ok: false })
    })
  })

  router.post('/upload', (req, res): void => {
    void upload(req, res, async (err: unknown): Promise<void> => {
      if (err) {
        log.log('/api/upload/', 'error', err)
        res.status(400).send('Something went wrong!')
        return
      }
      if (!req.file) {
        log.log('/api/upload/', 'error', 'no file')
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
      const nsfw = req.body.nsfw === 'true' ? 1 : 0
      const imageId = await im.insertImage({
        uploader_user_id: user.id,
        filename: req.file.filename,
        filename_original: req.file.originalname,
        title: req.body.title || '',
        copyright_name: req.body.copyrightName || '',
        copyright_url: server.urlUtil.fixUrl(req.body.copyrightURL || ''),
        created: newJSONDateString(),
        width: dim.w,
        height: dim.h,
        private: isPrivate,
        reported: 0,
        nsfw,
      })

      if (req.body.tags) {
        const tags = req.body.tags.split(',').filter((tag: string) => !!tag)
        await im.setTags(imageId, tags)
      }

      const imageInfo = await im.imageFromDb(imageId)
      if (!imageInfo) {
        res.status(400).send('Something went wrong!')
      } else {
        res.send(imageInfo)
      }
    })
  })

  router.get('/announcements', async (req, res) => {
    const items = await server.repos.announcements.getAll()
    const responseData: Api.AnnouncementsResponseData = items
    res.send(responseData)
  })

  router.post('/newgame', express.json(), async (req, res): Promise<void> => {
    const user = await server.users.getOrCreateUserByRequest(req)
    try {
      const gameId = await server.gameService.createNewGame(
        req.body as GameSettings,
        Time.timestamp(),
        user.id,
      )
      const responseData: Api.NewGameResponseData = { id: gameId }
      res.send(responseData)
    } catch (e: unknown) {
      log.error(e)
      const responseData: Api.NewGameResponseData = { reason: e instanceof Error ? e.message : String(e) }
      res.status(400).send(responseData)
    }
  })

  router.delete('/games/:id', async (req, res) => {
    const user: UserRow | null = req.userInfo?.user || null
    if (!user || !user.id) {
      const responseData: Api.DeleteGameResponseData = { ok: false, error: 'forbidden' }
      res.status(403).send(responseData)
      return
    }
    const id = req.params.id as GameId
    try {
      await server.gameService.deleteRunningGameIfCreatedByUser(id, user.id)
    } catch (e: unknown) {
      log.error(e)
      const responseData: Api.DeleteGameResponseData = { ok: false, error: e instanceof Error ? e.message : String(e) }
      res.status(400).send(responseData)
      return
    }
    const responseData: Api.DeleteGameResponseData = { ok: true }
    res.send(responseData)
  })

  router.post('/moderation/report-game', express.json(), async (req, res): Promise<void> => {
    const user: UserRow | null = req.userInfo?.user || null
    const reason = req.body.reason || ''
    const gameId = req.body.id as GameId
    if (!gameId) {
      const responseData: Api.ReportResponseData = { ok: false, error: 'bad id' }
      res.status(400).send(responseData)
      return
    }

    try {
      await server.moderation.reportGame(gameId, user, reason)
      await server.repos.games.reportGame(gameId)
      const responseData: Api.ReportResponseData = { ok: true }
      res.send(responseData)
    } catch {
      const responseData: Api.ReportResponseData = { ok: false, error: 'unknown error' }
      res.status(500).send(responseData)
    }
  })

  router.post('/moderation/report-image', express.json(), async (req, res): Promise<void> => {
    const user: UserRow | null = req.userInfo?.user || null
    const reason = req.body.reason || ''
    const imageIdInt = parseInt(`${req.body.id}`, 10)
    if (isNaN(imageIdInt) || imageIdInt < 0) {
      const responseData: Api.ReportResponseData = { ok: false, error: 'bad id' }
      res.status(400).send(responseData)
      return
    }
    const imageId = imageIdInt as ImageId

    try {
      await server.moderation.reportImage(imageId, user, reason)
      await server.repos.images.reportImage(imageId)
      const responseData: Api.ReportResponseData = { ok: true }
      res.send(responseData)
    } catch {
      const responseData: Api.ReportResponseData = { ok: false, error: 'unknown error' }
      res.status(500).send(responseData)
    }
  })

  return router
}
