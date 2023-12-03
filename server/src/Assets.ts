import { AssetsInterface, GraphicsInterface } from '../../common/src/Types'

export class Assets implements AssetsInterface{
  public Audio!: {
    CLICK: HTMLAudioElement | null
    CLICK_2: HTMLAudioElement | null
  }
  public Gfx!: {
    GRAB: ImageBitmap
    HAND: ImageBitmap
    GRAB_MASK: ImageBitmap
    HAND_MASK: ImageBitmap
  }

  async init (graphics: GraphicsInterface) {
    // TODO: parallel loading
    this.Audio = {
      CLICK: null,
      CLICK_2: null,
    }

    this.Gfx = {
      GRAB: await graphics.loadImageToBitmap(__dirname + '/../../frontend/src/assets/gfx/grab.png'),
      HAND: await graphics.loadImageToBitmap(__dirname + '/../../frontend/src/assets/gfx/hand.png'),
      GRAB_MASK: await graphics.loadImageToBitmap(__dirname + '/../../frontend/src/assets/gfx/grab_mask.png'),
      HAND_MASK: await graphics.loadImageToBitmap(__dirname + '/../../frontend/src/assets/gfx/hand_mask.png'),
    }
  }
}
