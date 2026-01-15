import multer from 'multer'
import config from './Config'
import Util from '@common/Util'
import express from 'express'

export class UploadRequestsManager {
  public static serveUploadsRequestHandler() {
    return express.static(config.dir.UPLOAD_DIR)
  }

  public static createUploadRequestHandler() {
    const storage = multer.diskStorage({
      destination: config.dir.UPLOAD_DIR,
      filename: function (_req, file, cb) {
        const basename = UploadRequestsManager.basename(file)
        const extension = UploadRequestsManager.extension(file)

        cb(null, `${basename}${extension}`)
      },
    })
    return multer({ storage }).single('file')
  }

  private static basename(file: Express.Multer.File) {
    return `${Util.uniqId()}-${Util.hash(file.originalname)}`
  }

  private static extension(file: Express.Multer.File) {
    switch (file.mimetype) {
      case 'image/png': return '.png'
      case 'image/jpeg': return '.jpeg'
      case 'image/webp': return '.webp'
      case 'image/gif': return '.gif'
      case 'image/svg+xml': return '.svg'
      default: {
        // try to keep original filename
        const m = file.filename.match(/\.[a-z]+$/)
        return m ? m[0] : '.unknown'
      }
    }
  }
}
