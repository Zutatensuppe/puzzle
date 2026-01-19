import type  Db from '../lib/Db'
import type { ImageId } from '@common/Types'

export interface ImageGifFrameRow {
  id: number;
  image_id: ImageId;
  frame_index: number;
  filename: string;
  delay_ms: number;
  created: Date;
}

export interface CreateImageGifFrameRow {
  image_id: ImageId;
  frame_index: number;
  filename: string;
  delay_ms: number;
}

export class ImageGifFramesRepo {
  constructor(private readonly db: Db) {}

  public async insertMany(frames: CreateImageGifFrameRow[]): Promise<void> {
    if (frames.length === 0) return;

    await this.db.insertMany('image_gif_frames', frames);
  }

  public async getByImageId(image_id: ImageId): Promise<ImageGifFrameRow[]> {
    return await this.db.getMany('image_gif_frames', { image_id }, [{ frame_index: 1 }]);
  }

  public async deleteByImageId(image_id: ImageId): Promise<void> {
    await this.db.delete('image_gif_frames', { image_id });
  }
}
