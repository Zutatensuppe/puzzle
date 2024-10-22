// @ts-ignore
import grab from './assets/gfx/grab.png'
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
import { Graphics } from './Graphics'
import { COLOR_MAGENTA } from '../../common/src/Color'

export class Assets {
  public Audio!: {
    CLICK: HTMLAudioElement
    CLICK_2: HTMLAudioElement
  }

  public Gfx!: {
    GRAB_RAW: ImageBitmap
    HAND_RAW: ImageBitmap
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

  async init (graphics: Graphics) {
    // TODO: parallel loading
    this.Audio = {
      CLICK: new Audio(click),
      CLICK_2: new Audio(click2),
    }

    const grabGfx = await graphics.loadImageToBitmap(grab)
    const handGfx = await graphics.loadImageToBitmap(hand)
    this.Gfx = {
      GRAB_RAW: grabGfx,
      HAND_RAW: handGfx,
      GRAB: await graphics.removeColor(grabGfx, COLOR_MAGENTA),
      HAND: await graphics.removeColor(handGfx, COLOR_MAGENTA),
      GRAB_MASK: await graphics.extractColor(grabGfx, COLOR_MAGENTA),
      HAND_MASK: await graphics.extractColor(handGfx, COLOR_MAGENTA),
      badgeMask: await graphics.loadImageToBitmap(badgeMask),
      badgeOver: await graphics.loadImageToBitmap(badgeOver),
      badgeOverIdle: await graphics.loadImageToBitmap(badgeOverIdle),
      badgeAnon: await graphics.loadImageToBitmap(badgeAnon),
      badgeAnonIdle: await graphics.loadImageToBitmap(badgeAnonIdle),
    }
  }
}
