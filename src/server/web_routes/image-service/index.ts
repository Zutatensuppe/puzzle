import express, { Request, Response, Router } from "express";
import path from "path";
import config from '../../Config'
import sharp from "sharp";
import { ServerInterface } from "../../Server";

export default function createRouter(
  server: ServerInterface,
): Router {
  const router = express.Router()
  router.get('/image/:filename', async (req: Request, res: Response) => {
    const filename = req.params.filename
    const query = req.query

    // RESIZE
    if (('w' in query && 'h' in query && 'fit' in query)) {
      const w = parseInt(`${query.w}`, 10)
      const h = parseInt(`${query.h}`, 10)
      const fit = `${query.fit}`
      if (`${w}` !== query.w || `${h}` !== query.h) {
        res.status(400).send('x, y must be numbers')
        return
      }
      const resizedFilename = await server.getImageResize().resizeImage(filename, w, h, fit as keyof sharp.FitEnum)
      if (!resizedFilename) {
        res.status(500).send('unable to resize image')
        return
      }

      const p = path.resolve(config.dir.RESIZE_DIR, resizedFilename)
      res.sendFile(p)
      return
    }

    // CROP
    if (('x' in query && 'y' in query && 'w' in query && 'h' in query)) {
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

      const maxSize = 1920
      const croppedFilename = await server.getImageResize().cropResizeImage(filename, crop, maxSize)
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
