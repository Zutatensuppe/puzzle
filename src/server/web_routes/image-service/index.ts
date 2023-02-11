import express, { Request, Response, Router } from "express";
import path from "path";
import ImageResize from "../../ImageResize";
import config from '../../Config'

export default function createRouter(
): Router {
  const router = express.Router()
  router.get('/image/:filename', async (req: Request, res: Response) => {
    const filename = req.params.filename
    const query = req.query
    if (!('x' in query && 'y' in query && 'w' in query && 'h' in query)) {
      const p = path.resolve(config.dir.UPLOAD_DIR, filename)
      res.sendFile(p)
      return
    }

    const crop = {
      x: parseInt(`${query.x}`, 10),
      y: parseInt(`${query.y}`, 10),
      w: parseInt(`${query.w}`, 10),
      h: parseInt(`${query.h}`, 10),
    }
    const croppedFilename = await ImageResize.cropImage(filename, crop)
    if (!croppedFilename) {
      res.status(500).send('unable to crop image')
      return
    }

    const p = path.resolve(config.dir.CROP_DIR, croppedFilename)
    res.sendFile(p)
  })
  return router
}
