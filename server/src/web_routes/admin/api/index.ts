import express from 'express'
import type { NextFunction } from 'express'
import type { Server } from '../../../Server'
import { MergeClientIdsIntoUser } from '../../../admin-tools/MergeClientIdsIntoUser'
import GameLog from '../../../GameLog'
import { FixPieces } from '../../../admin-tools/FixPieces'
import type { Api, FeaturedId, FeaturedTeaserRow, GameId, ImageId, ServerInfo } from '@common/Types'
import { newJSONDateString } from '@common/Util'
import GameCommon from '@common/GameCommon'

export default function createRouter(
  server: Server,
): express.Router {
  const router = express.Router()

  const requireLoginApi = async (req: express.Request, res: express.Response, next: NextFunction) => {
    if (!req.userInfo?.token) {
      res.status(401).send({})
      return
    }
    const user = req.userInfo.user || null
    if (!user || !user.id) {
      res.status(403).send({ ok: false, error: 'forbidden' })
      return
    }
    const isAdmin = await server.repos.users.isInGroup(user.id, 'admin')
    if (!isAdmin) {
      res.status(403).send({ ok: false, error: 'not an admin' })
      return
    }
    next()
  }

  router.use(requireLoginApi)

  router.get('/server-info', (_req, res) => {
    const responseData: ServerInfo = {
      socketCount: server.gameSockets.getSocketCount(),
      socketCountsByGameIds: server.gameSockets.getSocketCountsByGameIds(),
      gameLogInfoByGameIds: GameLog.getGameLogInfos(),
    }
    res.send(responseData)
  })

  const getPaginationParams = (
    req: express.Request,
  ): { offset: number, limit: number } => {
    const offset = parseInt(`${req.query.offset}`, 10)
    if (isNaN(offset) || offset < 0) {
      throw new Error('bad offset')
    }
    const limit = parseInt(`${req.query.limit}`, 10)
    if (isNaN(limit) || limit < 0) {
      throw new Error('bad limit')
    }
    return { offset, limit }
  }

  const createErrorResponseData = (
    error: unknown,
  ): Api.Admin.ErrorResponseData => {
    return {
      error: (error instanceof Error) ? error.message : String(error),
    }
  }

  router.get('/games', async (req, res) => {
    try {
      const { offset, limit } = getPaginationParams(req)
      const total = await server.repos.games.count()
      const items = await server.repos.games.getAllWithImagesAndUsers(offset, limit)
      const responseData: Api.Admin.GetGamesResponseData = {
        items,
        pagination: { total, offset, limit },
      }
      res.send(responseData)
    } catch (error) {
      res.status(400).send(createErrorResponseData(error))
    }
  })

  router.delete('/games/:id', async (req, res) => {
    const id = req.params.id as GameId
    await server.gameService.delete(id)
    const responseData: Api.Admin.DeleteGameResponseData = { ok: true }
    res.send(responseData)
  })

  router.get('/images', async (req, res) => {
    try {
      const { offset, limit } = getPaginationParams(req)

      const idsCsv = String(req.query.ids || '')
      let ids: ImageId[] = []
      if (idsCsv) {
        console.log('ids', idsCsv)
        ids = idsCsv.split(',').map(id => parseInt(id, 10) as ImageId)
      }

      const tagsCsv = String(req.query.tags || '')
      let tags: string[] = []
      if (tagsCsv) {
        tags = tagsCsv.split(',').map(tag => tag.trim())
      }

      const total = await server.repos.images.count()
      const items = await server.repos.images.getWithGameCount({
        offset,
        limit,
        filter: {
          ids,
          tags,
        },
      })
      const responseData: Api.Admin.GetImagesResponseData = {
        items,
        pagination: { total, offset, limit },
      }
      res.send(responseData)
    } catch (error) {
      res.status(400).send(createErrorResponseData(error))
    }
  })

  router.get('/featureds', async (req, res) => {
    try {
      const items = await server.repos.featured.getManyWithCollections({})
      const responseData: Api.Admin.GetFeaturedsResponseData = {
        items,
      }
      res.send(responseData)
    } catch (error) {
      res.status(400).send(createErrorResponseData(error))
    }
  })

  router.get('/featured-teasers', async (req, res) => {
    try {
      const items = await server.repos.featured.getAllTeasers()
      const responseData: Api.Admin.GetFeaturedTeasersResponseData = {
        items,
      }
      res.send(responseData)
    } catch (error) {
      res.status(400).send(createErrorResponseData(error))
    }
  })

  router.post('/featured-teasers', express.json(), async (req, res) => {
    const featuredTeasers: FeaturedTeaserRow[] = req.body.featuredTeasers
    await server.repos.featured.saveTeasers(featuredTeasers)
    const responseData: Api.Admin.PostFeaturedTeasersResponseData = { ok: true }
    res.send(responseData)
  })

  router.get('/featureds/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10) as FeaturedId
    const featured = await server.repos.featured.getWithCollections({ id })
    const responseData: Api.Admin.GetFeaturedResponseData = { featured }
    res.send(responseData)
  })

  router.put('/featureds/:id', express.json(), async (req, res) => {
    await server.repos.featured.updateWithCollections(req.body.featured)
    const responseData: Api.Admin.PutFeaturedResponseData = { ok: true }
    res.send(responseData)
  })

  router.post('/featureds', express.json(), async (req, res) => {
    const type = req.body.type
    const name = req.body.name
    const introduction = req.body.introduction
    const links = req.body.links
    const slug = req.body.slug

    const id = await server.repos.featured.insert({
      created: newJSONDateString(),
      type,
      name,
      introduction,
      links,
      slug,
    })
    const featured = await server.repos.featured.get({ id })
    if (!featured) {
      const responseData: Api.Admin.PostFeaturedsResponseData = {
        ok: false,
        reason: 'unable_to_get_featured',
      }
      res.status(500).send(responseData)
      return
    }
    const responseData: Api.Admin.PostFeaturedsResponseData = { featured }
    res.send(responseData)
  })

  router.delete('/images/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10) as ImageId
    const image = await server.repos.images.get({ id })
    if (!image) {
      const responseData: Api.Admin.DeleteImageResponseData = { error: 'image does not exist' }
      res.status(404).send(responseData)
      return
    }

    // delete from db
    await server.repos.images.delete(id)

    // delete from storage
    await server.images.deleteImagesFromStorage(image.filename)

    const responseData: Api.Admin.DeleteImageResponseData = { ok: true }
    res.send(responseData)
  })

  router.post('/images/:id/_set_private', async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10) as ImageId
      const image = await server.repos.images.get({ id })
      if (!image) {
        const responseData: Api.Admin.SetImagePrivateResponseData = { error: 'image does not exist' }
        res.status(404).send(responseData)
        return
      }

      await server.repos.images.update(
        { private: 1 },
        { id },
      )

      // set games currently in play to private, so they dont overwrite the db value when persisting
      const gameIds = await server.repos.games.getIds({ image_id: id })
      for (const gameId of gameIds) {
        const game = GameCommon.get(gameId)
        if (game) {
          GameCommon.Game_setPrivate(game, true)
        }
      }

      // update games in database too, so for queries its immediately active
      await server.repos.games.update(
        { private: 1 },
        { image_id: id },
      )

      // update leaderboards, as private games are excluded there they may have changed
      await server.repos.leaderboard.updateLeaderboards()

      const responseData: Api.Admin.SetImagePrivateResponseData = { ok: true }
      res.send(responseData)
    } catch (error) {
      res.status(400).send(createErrorResponseData(error))
    }
  })

  router.post('/images/:id/_approve', async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10) as ImageId
      const image = await server.repos.images.get({ id })
      if (!image) {
        const responseData: Api.Admin.ApproveImageResponseData = { error: 'image does not exist' }
        res.status(404).send(responseData)
        return
      }

      await server.repos.images.update(
        { state: 'approved' },
        { id },
      )

      const responseData: Api.Admin.ApproveImageResponseData = { ok: true }
      res.send(responseData)
    } catch (error) {
      res.status(400).send(createErrorResponseData(error))
    }
  })

  router.get('/images/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10) as ImageId
    const images = await server.images.imagesByIdsFromDb([id])
    if (images.length === 0) {
      const responseData: Api.Admin.GetImageResponseData = { error: 'not found' }
      res.status(404).send(responseData)
      return
    }
    const responseData: Api.Admin.GetImageResponseData = { image: images[0] }
    res.send(responseData)
  })

  router.get('/users', async (req, res) => {
    try {
      const { offset, limit } = getPaginationParams(req)
      const total = await server.repos.users.count()
      const items = await server.repos.users.getAll(offset, limit)
      const responseData: Api.Admin.GetUsersResponseData = {
        items,
        pagination: { total, offset, limit },
      }
      res.send(responseData)
    } catch (error) {
      res.status(400).send(createErrorResponseData(error))
    }
  })

  router.post('/users/_merge_client_ids_into_user', express.json(), async (req, res) => {
    const userId = req.body.userId
    const clientIds = req.body.clientIds
    const dry = req.body.dry === false ? false : true
    const job = new MergeClientIdsIntoUser(server.db)
    const result = await job.run(userId, clientIds, dry)
    const responseData: Api.Admin.PostUsersMergeClientIdsIntoUsersResponseData = result
    res.send(responseData)
  })

  router.post('/games/_fix_pieces', express.json(), async (req, res) => {
    const gameId = req.body.gameId
    const job = new FixPieces(server)
    const result = await job.run(gameId)
    const responseData: Api.Admin.PostGamesFixPiecesResponseData = result
    res.send(responseData)
  })

  router.get('/groups', async (_req, res) => {
    const items = await server.repos.users.getUserGroups()
    const responseData: Api.Admin.GetGroupsResponseData = items
    res.send(responseData)
  })

  router.get('/announcements', async (_req, res) => {
    const items = await server.repos.announcements.getAll()
    const responseData: Api.Admin.GetAnnouncementsResponseData = items
    res.send(responseData)
  })

  router.post('/announcements', express.json(), async (req, res) => {
    const message = req.body.message
    const title = req.body.title
    const id = await server.repos.announcements.insert({
      created: newJSONDateString(),
      title,
      message,
    })
    const announcement = await server.repos.announcements.get({ id })
    if (!announcement) {
      const responseData: Api.Admin.PostAnnouncementsResponseData = {
        ok: false,
        reason: 'unable_to_get_announcement',
      }
      res.status(500).send(responseData)
      return
    }
    void server.discord.announce(`**${title}**\n${announcement.message}`)
    const responseData: Api.Admin.PostAnnouncementsResponseData = { announcement }
    res.send(responseData)
  })

  return router
}
