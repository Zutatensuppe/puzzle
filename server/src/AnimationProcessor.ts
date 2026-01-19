import sharp from 'sharp'
import {logger} from '@common/Util'
import type {Dim} from '@common/Geometry'

const log = logger('AnimationProcessor.ts')

export interface AnimationFrame {
  buffer: Buffer;
  delay: number; // in milliseconds
}

export class AnimationProcessor {
  constructor() {  }

  public async hasMultipleFrames(filePath: string): Promise<boolean> {
    try {
      const metadata = await sharp(filePath).metadata()
      return (metadata.pages ?? 1) > 1
    } catch {
      return false
    }
  }

  public async extractFrames(filePath: string): Promise<AnimationFrame[]> {
    const image = sharp(filePath, {animated: true})
    const metadata = await image.metadata()

    if (!metadata.pages || metadata.pages <= 1) {
      throw new Error('Image has no animation frames')
    }

    const frameWidth = metadata.width || 0
    const pageHeight = metadata.pageHeight || metadata.height || 0
    if (frameWidth <= 0 || pageHeight <= 0) {
      throw new Error(`Invalid image dimensions: ${frameWidth}x${pageHeight}`)
    }

    // extract delay of each frame and store them in array
    // delays are in milliseconds, default to 100ms if not specified
    const rawDelays = (metadata.delay ?? []) as number[]
    const delays = rawDelays.map(d => d || 100)

    let data: Buffer
    let channels: 1 | 2 | 3 | 4
    try {
      // Extract raw pixel data from the full animated image (all frames stacked vertically)
      const result = await image.raw().toBuffer({ resolveWithObject: true })
      data = result.data
      channels = result.info.channels
    } catch (e) {
      throw new Error(`Failed to extract raw frame data: ${e}`)
    }

    const frameSize = frameWidth * pageHeight * channels
    const frames: AnimationFrame[] = []

    for (let i = 0; i < metadata.pages; i++) {
      try {
        const frameData = data.subarray(i * frameSize, (i + 1) * frameSize)

        const buffer = await sharp(frameData, {
          raw: { width: frameWidth, height: pageHeight, channels },
        })
          .png({ compressionLevel: 6, adaptiveFiltering: true })
          .toBuffer()

        frames.push({ buffer, delay: delays[i] || 100 })
      } catch (e) {
        log.error(`Failed to process frame ${i}:`, e)
      }
    }

    if (frames.length === 0) {
      throw new Error('No valid frames could be extracted from animated image')
    }

    log.info(`Extracted ${frames.length}/${metadata.pages} frames from animated image (${frameWidth}x${pageHeight})`)
    return frames
  }

  public async getDimensions(filePath: string): Promise<Dim> {
    try {
      const metadata = await sharp(filePath).metadata()
      return {
        w: metadata.width || 0,
        h: metadata.height || 0,
      }
    } catch (e) {
      log.error(`Failed to get image dimensions:`, e)
      return {w: 0, h: 0}
    }
  }
}
