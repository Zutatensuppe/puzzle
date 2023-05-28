import express, { Request, Response, Router } from 'express'
import path from 'path'
import config from '../../Config'
import { ServerInterface } from '../../Server'

export default function createRouter(
  server: ServerInterface,
): Router {
  const router = express.Router()
  router.get('/image/:filename', async (req: Request, res: Response) => {
    const filename = req.params.filename
    const query = req.query

    if (!query.mode) {
      res.status(400).send('invalid mode')
    }

    // RESIZE
    if (query.mode === 'resize') {
      const w = parseInt(`${query.w}`, 10)
      const h = parseInt(`${query.h}`, 10)
      const fit = `${query.fit}`
      if (`${w}` !== query.w || `${h}` !== query.h) {
        res.status(400).send('x, y must be numbers')
        return
      }
      if (fit !== 'contain' && fit !== 'cover') {
        res.status(400).send(`fit must be 'contain' or 'cover'`)
        return
      }
      const resizedFilename = await server.getImageResize().resizeImage(filename, w, h, fit)
      if (!resizedFilename) {
        res.status(500).send('unable to resize image')
        return
      }

      const p = path.resolve(config.dir.RESIZE_DIR, resizedFilename)
      res.sendFile(p)
      return
    }

    // RESTRICT SIZE
    if (query.mode === 'restrict') {
      const w = parseInt(`${query.w}`, 10)
      const h = parseInt(`${query.h}`, 10)
      if (
        `${w}` !== query.w ||
        `${h}` !== query.h
      ) {
        res.status(400).send('w and h must be numbers')
        return
      }

      const croppedFilename = await server.getImageResize().restrictImage(filename, w, h)
      if (!croppedFilename) {
        res.status(500).send('unable to restrict size image')
        return
      }

      const p = path.resolve(config.dir.CROP_DIR, croppedFilename)
      res.sendFile(p)
      return
    }

    // CROP with max WIDTH/HEIGHT
    if (query.mode === 'cropRestrict') {
      const crop = {
        x: parseInt(`${query.x}`, 10),
        y: parseInt(`${query.y}`, 10),
        w: parseInt(`${query.w}`, 10),
        h: parseInt(`${query.h}`, 10),
        mw: parseInt(`${query.mw}`, 10),
        mh: parseInt(`${query.mh}`, 10),
      }
      if (
        `${crop.x}` !== query.x ||
        `${crop.y}` !== query.y ||
        `${crop.w}` !== query.w ||
        `${crop.h}` !== query.h ||
        `${crop.mw}` !== query.mw ||
        `${crop.mh}` !== query.mh
      ) {
        res.status(400).send('x, y, w and h must be numbers')
        return
      }

      const croppedFilename = await server.getImageResize().cropRestrictImage(filename, crop, 1920, 1920)
      if (!croppedFilename) {
        res.status(500).send('unable to crop restrict image')
        return
      }

      const p = path.resolve(config.dir.CROP_DIR, croppedFilename)
      res.sendFile(p)
      return
    }

    // CROP
    if (query.mode === 'crop') {
      const crop = {
        x: parseInt(`${query.x}`, 10),
        y: parseInt(`${query.y}`, 10),
        w: parseInt(`${query.w}`, 10),
        h: parseInt(`${query.h}`, 10),
      }
      if (
        `${crop.x}` !== query.x ||
        `${crop.y}` !== query.y ||
        `${crop.w}` !== query.w ||
        `${crop.h}` !== query.h
      ) {
        res.status(400).send('x, y, w and h must be numbers')
        return
      }

      const croppedFilename = await server.getImageResize().cropImage(filename, crop)
      if (!croppedFilename) {
        res.status(500).send('unable to crop image')
        return
      }

      const p = path.resolve(config.dir.CROP_DIR, croppedFilename)
      res.sendFile(p)
      return
    }

    // original image
    const p = path.resolve(config.dir.UPLOAD_DIR, filename)
    res.sendFile(p)
    return
  })
  return router
}
