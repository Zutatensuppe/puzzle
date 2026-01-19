import type {ImageDataURL} from '@common/Types';
import {Graphics} from './Graphics';

export interface GifFrame {
  dataUrl: ImageDataURL;
  delay: number; // in milliseconds
}

export class AnimatedGifLoader {
  private static instance: AnimatedGifLoader;

  private constructor(private readonly gfx: Graphics) {
  }

  public static getInstance(): AnimatedGifLoader {
    return AnimatedGifLoader.instance ??= new AnimatedGifLoader(Graphics.getInstance());
  }

  public async loadGifFrames(imageId: number): Promise<GifFrame[] | null> {
    try {
      const response = await fetch(`/api/gif-frames/${imageId}`);
      if (!response.ok) {
        console.error(`Failed to load GIF frames: HTTP ${response.status} for /api/gif-frames/${imageId}`);
        return null;
      }

      const framesData = await response.json() as Array<{ filename: string, delay_ms: number }>;

      return await Promise.all(framesData.map(async (frameData, index) => {
        try {
          const src = `/uploads/c/${frameData.filename}`;
          const dataUrl = await this.gfx.loader.dataUrlFromSrc(src);
          return {dataUrl, delay: frameData.delay_ms};
        } catch (e) {
          console.error(`Failed to load frame ${index} (${frameData.filename}):`, e);
          throw e;
        }
      }));
    } catch (e) {
      console.error('Error loading GIF frames:', e);
      return null;
    }
  }

  public async loadGifAsImageBitmap(imageId: number): Promise<ImageBitmap | null> {
    try {
      const response = await fetch(`/api/image/${imageId}`);
      if (!response.ok) {
        return null;
      }

      const imageInfo = await response.json();
      return await this.gfx.loader.imageBitmapFromSrc(imageInfo.url);
    } catch (e) {
      console.error('Error loading GIF as ImageBitmap:', e);
      return null;
    }
  }
}
