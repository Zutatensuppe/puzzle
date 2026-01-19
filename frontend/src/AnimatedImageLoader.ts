import type { ImageFrameMeta } from '@common/Types'
import { Graphics } from './Graphics'

export interface ImageFrame {
  canvas: HTMLCanvasElement
  delay: number // milliseconds
}

/**
 * Resolves an image per-frame metadata (already present on ImageInfo) into
 * loaded data URLs that the renderers can decode. The actual frame PNGs are
 * served as static assets under /uploads/c/<filename>.
 */
export class AnimatedImageLoader {
  private static instance: AnimatedImageLoader

  private constructor(private readonly gfx: Graphics) {}

  public static getInstance(): AnimatedImageLoader {
    return AnimatedImageLoader.instance ??= new AnimatedImageLoader(Graphics.getInstance())
  }

  public loadFrames(metas: ImageFrameMeta[]): Promise<ImageFrame[]> {
    return Promise.all(metas.map(async (m) => ({
      canvas: await this.gfx.loader.canvasFromSrc(`/uploads/c/${m.filename}`),
      delay: m.delay_ms,
    })))
  }
}
