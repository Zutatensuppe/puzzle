import express, { NextFunction } from 'express'
import Db from '../../../Db'
import { Discord } from '../../../Discord'

export default function createRouter(
  db: Db,
  discord: Discord,
): express.Router {
  const router = express.Router()

  const requireLoginApi = async (req: any, res: any, next: NextFunction) => {
    if (!req.token) {
      res.status(401).send({})
      return
    }
    // TODO: check if user is admin
    next()
  }

  router.use(requireLoginApi)

  router.get('/games', async (req, res) => {
    const items = await db.getMany('games')
    res.send(items)
  })

  router.delete('/games/:id', async (req, res) => {
    const id = req.params.id
    await db.delete('games', { id })
    res.send({ ok: true })
  })

  router.get('/images', async (req, res) => {
    const items = await db.getMany('images')
    res.send(items)
  })

  router.delete('/images/:id', async (req, res) => {
    const id = req.params.id
    await db.delete('images', { id })
    res.send({ ok: true })
  })

  router.get('/users', async (req, res) => {
    const items = await db.getMany('users')
    res.send(items.map(item => {
      delete item.client_id
      return item
    }))
  })

  router.get('/groups', async (req, res) => {
    const items = await db.getMany('user_groups')
    res.send(items)
  })

  router.get('/announcements', async (req, res) => {
    const items = await db.getMany('announcements')
    res.send(items)
  })

  router.post('/announcements', express.json(), async (req, res) => {
    const message = req.body.message
    const title = req.body.title
    const id = await db.insert('announcements', { created: new Date(), title, message }, 'id')

    const announcement = await db.get('announcements', { id })
    await discord.announce(`**${title}**\n${announcement.message}`)
    res.send({ announcement })
  })

  return router
}
