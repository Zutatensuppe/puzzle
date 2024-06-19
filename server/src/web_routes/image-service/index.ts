import express, { Request, Response, Router } from 'express'
import path from 'path'
import config from '../../Config'
import { ServerInterface } from '../../Server'
import fs from '../../FileSystem'

export default function createRouter(
  server: ServerInterface,
): Router {
  const router = express.Router()
  router.get('/image/*', async (req: Request, res: Response) => {
    const filename = req.url.split('?')[0].substring('/image/'.length)
    const originalFile = path.resolve(config.dir.UPLOAD_DIR, decodeURIComponent(filename))
    if (!await fs.exists(originalFile)) {
      res.status(404)
      return
    }
    const targetFilename = filename.replace(/\//g, '_')
    const query = req.query
    const format = `${query.format || 'webp'}`
    if (!query.mode) {
      res.status(400).send('invalid mode')
      return
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
      const resizedFilename = await server.getImageResize().resizeImage(originalFile, targetFilename, w, h, fit, format)
      if (!resizedFilename) {
        res.status(500).send('unable to resize image')
        return
      }

      res.header('Content-Type', 'image/' + format)
      res.sendFile(resizedFilename)
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

      const croppedFilename = await server.getImageResize().restrictImage(originalFile, targetFilename, w, h, format)
      if (!croppedFilename) {
        res.status(500).send('unable to restrict size image')
        return
      }

      res.header('Content-Type', 'image/' + format)
      res.sendFile(croppedFilename)
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

      const croppedFilename = await server.getImageResize().cropRestrictImage(originalFile, targetFilename, crop, 1920, 1920, format)
      if (!croppedFilename) {
        res.status(500).send('unable to crop restrict image')
        return
      }

      res.sendFile(croppedFilename)
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

      const croppedFilename = await server.getImageResize().cropImage(originalFile, targetFilename, crop, format)
      if (!croppedFilename) {
        res.status(500).send('unable to crop image')
        return
      }

      res.header('Content-Type', 'image/' + format)
      res.sendFile(croppedFilename)
      return
    }

    // original image
    res.sendFile(originalFile)
    return
  })
  return router
}
