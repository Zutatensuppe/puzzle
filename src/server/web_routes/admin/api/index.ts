import express, { NextFunction } from 'express'
import Db from '../../../Db'

export default function createRouter(
  db: Db
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
      delete item.client_secret
      delete item.pass
      delete item.salt
      return item
    }))
  })

  router.get('/groups', async (req, res) => {
    const items = await db.getMany('user_groups')
    res.send(items)
  })

  return router
}
