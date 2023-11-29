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
  public Textures!: {
    WOOD_DARK: ImageBitmap
    WOOD_LIGHT: ImageBitmap
    OAK_BROWN: ImageBitmap
  }

  async init (graphics: GraphicsInterface) {
    // TODO: parallel loading
    this.Audio = {
      CLICK: null,
      CLICK_2: null,
    }

    this.Gfx = {
      GRAB: await graphics.loadImageToBitmap(__dirname + '/../../common/src/assets/gfx/grab.png'),
      HAND: await graphics.loadImageToBitmap(__dirname + '/../../common/src/assets/gfx/hand.png'),
      GRAB_MASK: await graphics.loadImageToBitmap(__dirname + '/../../common/src/assets/gfx/grab_mask.png'),
      HAND_MASK: await graphics.loadImageToBitmap(__dirname + '/../../common/src/assets/gfx/hand_mask.png'),
    }

    this.Textures = {
      WOOD_DARK: await graphics.loadImageToBitmap(__dirname + '/../../common/src/assets/textures/wood-dark.jpg'),
      WOOD_LIGHT: await graphics.loadImageToBitmap(__dirname + '/../../common/src/assets/textures/wood-light.jpg'),
      OAK_BROWN: await graphics.loadImageToBitmap(__dirname + '/../../common/src/assets/textures/Oak-none-3275x2565mm-Architextures.jpg'),
    }
  }
}
