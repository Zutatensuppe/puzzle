import type { Api, UserId, UserRow } from '@common/Types'
import type { NextFunction } from 'express'
import express from 'express'
import { logger, newJSONDateString } from '@common/Util'
import { COOKIE_TOKEN } from '../../Auth'
import type { Server } from '../../Server'
import type { DeleteAvatarRequestData } from '@common/TypesApi'
import { UploadRequestsManager } from '../../UploadRequestsManager'

const log = logger('web_routes/api/index.ts')

const requireLoggedInUserApi = (req: express.Request, res: express.Response, next: NextFunction) => {
  if (!req.userInfo?.token) {
    res.status(401).send({})
    return
  }
  const user = req.userInfo.user || null
  if (!user || !user.id) {
    res.status(403).send({ ok: false, error: 'forbidden' })
    return
  }
  if (req.userInfo.user_type !== 'user') {
    res.status(403).send({ ok: false, error: 'forbidden' })
    return
  }
  next()
}

export default function createRouter(
  server: Server,
): express.Router {

  const upload = UploadRequestsManager.createUploadRequestHandler()

  const router = express.Router()

  router.use(requireLoggedInUserApi)

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

  router.get('/settings/:id', async (req, res): Promise<void> => {
    if (req.userInfo?.user_type !== 'user') {
      res.status(403).send({ reason: 'forbidden' })
      return
    }

    const currentUserId = req.userInfo?.user?.id ?? 0 as UserId
    const limitToUserId = parseInt(`${req.params.id}`, 10) as UserId
    if (limitToUserId !== currentUserId) {
      res.status(403).send({ reason: 'forbidden' })
      return
    }

    try {
      const responseData: Api.UserSettingsResponseData = {
        userSettings: await server.users.getCompleteUserSettings(currentUserId),
      }
      res.send(responseData)
    } catch (e: unknown) {
      res.status(404).send({ reason: e instanceof Error ? e.message : String(e) })
    }
  })

  router.post('/settings', express.json(), async (req, res): Promise<void> => {
    const user: UserRow | null = req.userInfo?.user || null
    if (!user || !user.id || req.userInfo?.user_type !== 'user') {
      res.status(403).send({ ok: false, error: 'forbidden' })
      return
    }

    const data = req.body as Api.UpdateUserSettingsRequestData

    try {
      const userSettings = await server.repos.users.getUserSettings(user.id)

      await server.repos.users.updateUserSettings({
        userId: user.id,
        avatarId: userSettings.avatarId,
        nsfwActive: data.nsfwActive,
        nsfwUnblurred: data.nsfwUnblurred,
      })
      const responseData: Api.UserSettingsResponseData = {
        userSettings: await server.users.getCompleteUserSettings(user.id),
      }
      res.send(responseData)
    } catch (e: unknown) {
      res.status(404).send({ reason: e instanceof Error ? e.message : String(e) })
    }
  })

  router.post('/delete-avatar', express.json(), async (req: express.Request, res): Promise<void> => {
    const user: UserRow | null = req.userInfo?.user || null
    if (!user || !user.id) {
      res.status(403).send({ ok: false, error: 'forbidden' })
      return
    }

    const data = req.body as DeleteAvatarRequestData

    try {
      const settings = await server.repos.users.getUserSettings(user.id)

      // make sure the avatar id is the one the
      // user (making the request) currently has set
      if (settings.avatarId !== data.avatarId) {
        res.status(403).send({ ok: false, error: 'forbidden' })
        return
      }

      settings.avatarId = null
      await server.repos.users.updateUserSettings(settings)

      await server.users.deleteAvatar(data.avatarId)

      res.send({ ok: true })
    } catch {
      res.status(400).send('Something went wrong!')
    }
  })

  router.post('/upload-avatar', (req, res): void => {
    void upload(req, res, async (err: unknown): Promise<void> => {
      if (err) {
        log.log('/api/user/upload-avatar', 'error', err)
        res.status(400).send('Something went wrong!')
        return
      }
      if (!req.file) {
        log.log('/api/user/upload-avatar', 'error', 'no file')
        res.status(400).send('Something went wrong!')
        return
      }

      log.info('req.file.filename', req.file.filename)

      const im = server.images

      const user = await server.users.getOrCreateUserByRequest(req)

      const imagePath = im.getImagePath(req.file.filename)
      const dim = await im.getDimensions(imagePath)

      try {
        const userSettings = await server.repos.users.getUserSettings(user.id)

        const avatarId = await server.repos.users.saveAvatar({
          created: newJSONDateString(),
          filename: req.file.filename,
          filename_original: req.file.originalname,
          width: dim.w,
          height: dim.h,
        })

        userSettings.avatarId = avatarId

        await server.repos.users.updateUserSettings(userSettings)

        const avatar = await server.repos.users.getUserAvatarByUserId(user.id)

        res.send(avatar)
      } catch {
        res.status(400).send('Something went wrong!')
      }
    })
  })

  return router
}
