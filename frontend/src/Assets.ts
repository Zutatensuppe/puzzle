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
import stencilsDefault from './assets/stencils/default.png'

// @ts-ignore
import click from './assets/sounds/click.mp3'
// @ts-ignore
import click2 from './assets/sounds/click2.mp3'
// @ts-ignore
import rotate from './assets/sounds/rotate2.mp3'
import type { Graphics } from './Graphics'
import type { ImageDataURL } from '@common/Types'
import { COLOR_MAGENTA } from '@common/Color'

export class Assets {
  public inited = false

  public Audio!: {
    CLICK: HTMLAudioElement
    CLICK_2: HTMLAudioElement
    ROTATE: HTMLAudioElement
  }

  public Gfx!: {
    GRAB_RAW: ImageBitmap
    HAND_RAW: ImageBitmap
    GRAB: HTMLCanvasElement
    HAND: HTMLCanvasElement
    GRAB_MASK: HTMLCanvasElement
    HAND_MASK: HTMLCanvasElement
    badgeMask: ImageBitmap
    badgeOver: ImageBitmap
    badgeOverIdle: ImageBitmap
    badgeAnon: ImageDataURL
    badgeAnonIdle: ImageDataURL
    stencilsDefault: ImageBitmap
  }

  async init (graphics: Graphics) {
    if (this.inited) {
      return
    }
    this.inited = true

    this.Audio = {
      CLICK: new Audio(click),
      CLICK_2: new Audio(click2),
      ROTATE: new Audio(rotate),
    }

    const grabGfx = await graphics.loader.imageBitmapFromSrc(grab)
    const handGfx = await graphics.loader.imageBitmapFromSrc(hand)
    this.Gfx = {
      GRAB_RAW: grabGfx,
      HAND_RAW: handGfx,
      GRAB: graphics.op.removeColor(grabGfx, COLOR_MAGENTA),
      HAND: graphics.op.removeColor(handGfx, COLOR_MAGENTA),
      GRAB_MASK: graphics.op.extractColor(grabGfx, COLOR_MAGENTA),
      HAND_MASK: graphics.op.extractColor(handGfx, COLOR_MAGENTA),
      badgeMask: await graphics.loader.imageBitmapFromSrc(badgeMask),
      badgeOver: await graphics.loader.imageBitmapFromSrc(badgeOver),
      badgeOverIdle: await graphics.loader.imageBitmapFromSrc(badgeOverIdle),
      badgeAnon: await graphics.loader.dataUrlFromSrc(badgeAnon),
      badgeAnonIdle: await graphics.loader.dataUrlFromSrc(badgeAnonIdle),
      stencilsDefault: await graphics.loader.imageBitmapFromSrc(stencilsDefault),
    }
  }
}
