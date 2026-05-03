import type { Images } from '../Images'
import type { ImagesRepo } from '../repo/ImagesRepo'
import { detectAiMarkersFromFile } from '../AiImageDetection'

export interface DetectAiImagesResult {
  scanned: number
  flagged: number
}

export class DetectAiImages {
  constructor(
    private readonly images: Images,
    private readonly imagesRepo: ImagesRepo,
  ) {}

  public async run(): Promise<DetectAiImagesResult> {
    const unflagged = await this.imagesRepo.getMany({ ai_generated: 0 })
    let flagged = 0

    for (const image of unflagged) {
      const imagePath = this.images.getImagePath(image.filename)
      if (await detectAiMarkersFromFile(imagePath)) {
        await this.imagesRepo.update({ ai_generated: 1 }, { id: image.id })
        flagged++
      }
    }

    return { scanned: unflagged.length, flagged }
  }
}
