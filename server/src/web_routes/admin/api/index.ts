import express, { NextFunction } from 'express'
import { ServerInterface } from '../../../Server'
import { MergeClientIdsIntoUser } from '../../../admin-tools/MergeClientIdsIntoUser'
import { ServerInfo } from '../../../Types'
import GameLog from '../../../GameLog'

export default function createRouter(
  server: ServerInterface,
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
    const adminGroup = await server.getDb().get('user_groups', { name: 'admin' })
    if (!adminGroup) {
      res.status(403).send({ ok: false, error: 'no admin' })
      return
    }
    const userXAdmin = await server.getDb().get('user_x_user_group', {
      user_group_id: adminGroup.id,
      user_id: user.id,
    })
    if (!userXAdmin) {
      res.status(403).send({ ok: false, error: 'not an admin' })
      return
    }
    next()
  }

  router.use(requireLoginApi)

  router.get('/server-info', async (req, res) => {
    res.send(<ServerInfo>{
      socketCount: server.getGameSockets().getSocketCount(),
      socketCountsByGameIds: server.getGameSockets().getSocketCountsByGameIds(),
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

    const total = await server.getDb().count('games')
    const items = await server.getDb().getMany('games', undefined, [{ created: -1 }], { offset, limit })
    const imageIdMap: Record<string, boolean> = {}
    items.forEach(game => {
      imageIdMap[game.image_id] = true
    })
    const imageIds = Object.keys(imageIdMap)
    const images = await server.getDb().getMany('images', { id: { '$in': imageIds } })
    const gamesWithImages = items.map(game => {
      game.image = images.find(image => image.id === game.image_id) || null
      return game
    })
    res.send({
      items: gamesWithImages,
      pagination: { total, offset, limit },
    })
  })

  router.delete('/games/:id', async (req, res) => {
    const id = req.params.id
    await server.getDb().delete('games', { id })
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

    const limitSql = server.getDb()._buildLimit({ offset, limit })
    const total = await server.getDb().count('images')
    const items = await server.getDb()._getMany(`
      select i.*, count(g.id) as game_count
      from images i left join games g on g.image_id = i.id
      group by i.id
      order by i.id desc
      ${limitSql};
    `)
    res.send({
      items,
      pagination: { total, offset, limit },
    })
  })

  router.delete('/images/:id', async (req, res) => {
    const id = req.params.id
    await server.getDb().delete('images', { id })
    res.send({ ok: true })
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

    const total = await server.getDb().count('users')
    const items = await server.getDb().getMany('users', undefined, [{ id: -1 }], { offset, limit })
    res.send({
      items,
      pagination: { total, offset, limit },
    })
  })

  router.post('/users/_merge_client_ids_into_user', express.json(), async (req, res) => {
    const userId = req.body.userId
    const clientIds = req.body.clientIds
    const dry = req.body.dry === false ? false : true
    const job = new MergeClientIdsIntoUser(server.getDb())
    const result = await job.run(userId, clientIds, dry)
    res.send(result)
  })

  router.post('/games/_fix_pieces', express.json(), async (req, res) => {
    const gameId = req.body.gameId
    const result = await server.fixPieces(gameId)
    res.send(result)
  })

  router.get('/groups', async (req, res) => {
    const items = await server.getDb().getMany('user_groups', undefined, [{ id: -1 }])
    res.send(items)
  })

  router.get('/announcements', async (req, res) => {
    const items = await server.getAnnouncementsRepo().getAll()
    res.send(items)
  })

  router.post('/announcements', express.json(), async (req, res) => {
    const message = req.body.message
    const title = req.body.title
    const id = await server.getAnnouncementsRepo().insert({ created: new Date(), title, message })
    const announcement = await server.getAnnouncementsRepo().get({ id })
    if (!announcement) {
      res.status(500).send({ ok: false, reason: 'unable_to_get_announcement' })
      return
    }
    await server.getDiscord().announce(`**${title}**\n${announcement.message}`)
    res.send({ announcement })
  })

  return router
}
