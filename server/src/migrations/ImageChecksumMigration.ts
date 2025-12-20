import FileSystem from '../lib/FileSystem'
import type { Server } from '../Server'
import { logger } from '@common/Util'

const log = logger('ImageChecksumMigration.ts')

export class ImageChecksumMigration {
  constructor(private readonly server: Server) {}

  public async run(): Promise<void> {
    const images = await this.server.repos.images.getMany({
      checksum: null,
    })
    let missing = 0
    let success = 0
    for (const image of images) {
      const imagePath = this.server.images.getImagePath(image.filename)
      if (await FileSystem.exists(imagePath)) {
        log.info(`Processing image ${image.id} (${image.filename})`)
        const checksum = await FileSystem.checksum(imagePath)
        await this.server.repos.images.update({ checksum }, { id: image.id })
        log.info(`Updated checksum for image ${image.id} (${image.filename})`)
        success++
      } else {
        log.info(`file does not exist: ${imagePath}`)
        missing++
      }
    }
    log.info(`Migration completed: ${success} images updated, ${missing} files not found.`)
  }
}
