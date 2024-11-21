import express, { NextFunction } from 'express'
import { Server } from '../../../Server'
import { MergeClientIdsIntoUser } from '../../../admin-tools/MergeClientIdsIntoUser'
import { FeaturedId, GameId, ImageId, ServerInfo } from '../../../Types'
import GameLog from '../../../GameLog'
import { FixPieces } from '../../../admin-tools/FixPieces'

export default function createRouter(
  server: Server,
): express.Router {
  const router = express.Router()

  const requireLoginApi = async (req: any, res: any, next: NextFunction) => {
    if (!req.token) {
      res.status(401).send({})
      return
    }
    const user = req.user || null
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
    res.send(<ServerInfo>{
      socketCount: server.gameSockets.getSocketCount(),
      socketCountsByGameIds: server.gameSockets.getSocketCountsByGameIds(),
      gameLogInfoByGameIds: GameLog.getGameLogInfos(),
    })
  })

  router.get('/games', async (req, res) => {
    const offset = parseInt(`${req.query.offset}`, 10)
    if (isNaN(offset) || offset < 0) {
      res.status(400).send({ error: 'bad offset' })
      return
    }
    const limit = parseInt(`${req.query.limit}`, 10)
    if (isNaN(limit) || limit < 0) {
      res.status(400).send({ error: 'bad limit' })
      return
    }

    const total = await server.repos.games.count()
    const items = await server.repos.games.getAllWithImagesAndUsers(offset, limit)
    res.send({
      items,
      pagination: { total, offset, limit },
    })
  })

  router.delete('/games/:id', async (req, res) => {
    const id = req.params.id as GameId
    await server.gameService.delete(id)
    res.send({ ok: true })
  })

  router.get('/images', async (req, res) => {
    const offset = parseInt(`${req.query.offset}`, 10)
    if (isNaN(offset) || offset < 0) {
      res.status(400).send({ error: 'bad offset' })
      return
    }
    const limit = parseInt(`${req.query.limit}`, 10)
    if (isNaN(limit) || limit < 0) {
      res.status(400).send({ error: 'bad limit' })
      return
    }

    const total = await server.repos.images.count()
    const items = await server.repos.images.getAllWithGameCount(offset, limit)
    res.send({
      items,
      pagination: { total, offset, limit },
    })
  })

  router.get('/featureds', async (req, res) => {
    const offset = parseInt(`${req.query.offset}`, 10)
    if (isNaN(offset) || offset < 0) {
      res.status(400).send({ error: 'bad offset' })
      return
    }
    const limit = parseInt(`${req.query.limit}`, 10)
    if (isNaN(limit) || limit < 0) {
      res.status(400).send({ error: 'bad limit' })
      return
    }

    const total = await server.repos.featured.count()
    const items = await server.repos.featured.getAll(offset, limit)
    res.send({
      items,
      pagination: { total, offset, limit },
    })
  })

  router.get('/featureds/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10) as FeaturedId
    const featured = await server.repos.featured.getWithCollections({ id })
    res.send({ featured })
  })

  router.put('/featureds/:id', express.json(), async (req, res) => {
    await server.repos.featured.updateWithCollections(req.body.featured)
    res.send({ ok: true })
  })

  router.post('/featureds', express.json(), async (req, res) => {
    const type = req.body.type
    const name = req.body.name
    const introduction = req.body.introduction
    const links = req.body.links

    const id = await server.repos.featured.insert({
      created: new Date(),
      type,
      name,
      introduction,
      links,
    })
    const featured = await server.repos.featured.get({ id })
    if (!featured) {
      res.status(500).send({ ok: false, reason: 'unable_to_get_featured' })
      return
    }
    res.send({ featured })
  })

  router.delete('/images/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10) as ImageId
    await server.repos.images.delete(id)
    res.send({ ok: true })
  })

  router.get('/images/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10) as ImageId
    const images = await server.images.imagesByIdsFromDb([id])
    if (images.length === 0) {
      res.status(404).send({ error: 'not found' })
      return
    }
    res.send({ image: images[0] })
  })

  router.get('/users', async (req, res) => {
    const offset = parseInt(`${req.query.offset}`, 10)
    if (isNaN(offset) || offset < 0) {
      res.status(400).send({ error: 'bad offset' })
      return
    }
    const limit = parseInt(`${req.query.limit}`, 10)
    if (isNaN(limit) || limit < 0) {
      res.status(400).send({ error: 'bad limit' })
      return
    }

    const total = await server.repos.users.count()
    const items = await server.repos.users.getAll(offset, limit)
    res.send({
      items,
      pagination: { total, offset, limit },
    })
  })

  router.post('/users/_merge_client_ids_into_user', express.json(), async (req, res) => {
    const userId = req.body.userId
    const clientIds = req.body.clientIds
    const dry = req.body.dry === false ? false : true
    const job = new MergeClientIdsIntoUser(server.db)
    const result = await job.run(userId, clientIds, dry)
    res.send(result)
  })

  router.post('/games/_fix_pieces', express.json(), async (req, res) => {
    const gameId = req.body.gameId
    const job = new FixPieces(server)
    const result = await job.run(gameId)
    res.send(result)
  })

  router.get('/groups', async (_req, res) => {
    const items = await server.repos.users.getUserGroups()
    res.send(items)
  })

  router.get('/announcements', async (_req, res) => {
    const items = await server.repos.announcements.getAll()
    res.send(items)
  })

  router.post('/announcements', express.json(), async (req, res) => {
    const message = req.body.message
    const title = req.body.title
    const id = await server.repos.announcements.insert({ created: new Date(), title, message })
    const announcement = await server.repos.announcements.get({ id })
    if (!announcement) {
      res.status(500).send({ ok: false, reason: 'unable_to_get_announcement' })
      return
    }
    server.discord.announce(`**${title}**\n${announcement.message}`)
    res.send({ announcement })
  })

  return router
}
