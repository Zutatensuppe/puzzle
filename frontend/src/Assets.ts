// @ts-ignore
import grabMask from './assets/gfx/grab_mask.png'
// @ts-ignore
import grab from './assets/gfx/grab.png'
// @ts-ignore
import handMask from './assets/gfx/hand_mask.png'
// @ts-ignore
import hand from './assets/gfx/hand.png'

// @ts-ignore
import woodDark from './assets/textures/wood-dark.jpg'
// @ts-ignore
import woodLight from './assets/textures/wood-light.jpg'
// @ts-ignore
import oakBrown from './assets/textures/Oak-none-3275x2565mm-Architextures.jpg'

// @ts-ignore
import click from './assets/sounds/click.mp3'
// @ts-ignore
import click2 from './assets/sounds/click2.mp3'

import { AssetsInterface, GraphicsInterface } from '../../common/src/Types'

export class Assets implements AssetsInterface {
  public Audio!: {
    CLICK: HTMLAudioElement
    CLICK_2: HTMLAudioElement
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
      CLICK: new Audio(click),
      CLICK_2: new Audio(click2),
    }

    this.Gfx = {
      GRAB: await graphics.loadImageToBitmap(grab),
      HAND: await graphics.loadImageToBitmap(hand),
      GRAB_MASK: await graphics.loadImageToBitmap(grabMask),
      HAND_MASK: await graphics.loadImageToBitmap(handMask),
    }

    this.Textures = {
      WOOD_DARK: await graphics.loadImageToBitmap(woodDark),
      WOOD_LIGHT: await graphics.loadImageToBitmap(woodLight),
      OAK_BROWN: await graphics.loadImageToBitmap(oakBrown),
    }
  }
}
