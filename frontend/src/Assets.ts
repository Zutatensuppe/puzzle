// @ts-ignore
import grabMask from './assets/gfx/grab_mask.png'
// @ts-ignore
import grab from './assets/gfx/grab.png'
// @ts-ignore
import handMask from './assets/gfx/hand_mask.png'
// @ts-ignore
import hand from './assets/gfx/hand.png'

// @ts-ignore
import badgeMask from './assets/gfx/badge_mask.png'
// @ts-ignore
import badgeOver from './assets/gfx/badge_over.png'
// @ts-ignore
import badgeOverIdle from './assets/gfx/badge_over_idle.png'
// @ts-ignore
import badgeAnon from './assets/gfx/badge_anon.png'
// @ts-ignore
import badgeAnonIdle from './assets/gfx/badge_anon_idle.png'

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
    badgeMask: ImageBitmap
    badgeOver: ImageBitmap
    badgeOverIdle: ImageBitmap
    badgeAnon: ImageBitmap
    badgeAnonIdle: ImageBitmap
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
      badgeMask: await graphics.loadImageToBitmap(badgeMask),
      badgeOver: await graphics.loadImageToBitmap(badgeOver),
      badgeOverIdle: await graphics.loadImageToBitmap(badgeOverIdle),
      badgeAnon: await graphics.loadImageToBitmap(badgeAnon),
      badgeAnonIdle: await graphics.loadImageToBitmap(badgeAnonIdle),
    }
  }
}
