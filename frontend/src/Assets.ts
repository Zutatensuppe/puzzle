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
import { COLOR_MAGENTA } from '../../common/src/Color'
import type { ImageDataURL } from './Types'
import { GraphicsEnum, SoundsEnum } from '../../common/src/Constants'

export class Assets {
  public inited = false

  public Audio!: Record<SoundsEnum, HTMLAudioElement>

  public Gfx!: {
    [GraphicsEnum.CURSOR_HAND_RAW]: ImageBitmap
    [GraphicsEnum.CURSOR_HAND]: HTMLCanvasElement
    [GraphicsEnum.CURSOR_HAND_MASK]: HTMLCanvasElement

    [GraphicsEnum.CURSOR_GRAB_RAW]: ImageBitmap
    [GraphicsEnum.CURSOR_GRAB]: HTMLCanvasElement
    [GraphicsEnum.CURSOR_GRAB_MASK]: HTMLCanvasElement

    [GraphicsEnum.BADGE_MASK]: ImageBitmap
    [GraphicsEnum.BADGE_OVERLAY_ACTIVE]: ImageBitmap
    [GraphicsEnum.BADGE_OVERLAY_IDLE]: ImageBitmap

    [GraphicsEnum.BADGE_ANON_ACTIVE]: ImageDataURL
    [GraphicsEnum.BADGE_ANON_IDLE]: ImageDataURL

    [GraphicsEnum.PIECE_STENCILS_SPRITESHEET]: ImageBitmap
  }

  async init (graphics: Graphics) {
    if (this.inited) {
      return
    }
    this.inited = true

    this.Audio = {
      [SoundsEnum.PIECE_CONNECTED]: new Audio(click),
      [SoundsEnum.OPPONENT_PIECE_CONNECTED]: new Audio(click2),
      [SoundsEnum.PIECE_ROTATED]: new Audio(rotate),
    }

    const handGfx = await graphics.loader.imageBitmapFromSrc(hand)
    const grabGfx = await graphics.loader.imageBitmapFromSrc(grab)
    this.Gfx = {
      [GraphicsEnum.CURSOR_HAND_RAW]: handGfx,
      [GraphicsEnum.CURSOR_HAND]: graphics.op.removeColor(handGfx, COLOR_MAGENTA),
      [GraphicsEnum.CURSOR_HAND_MASK]: graphics.op.extractColor(handGfx, COLOR_MAGENTA),

      [GraphicsEnum.CURSOR_GRAB_RAW]: grabGfx,
      [GraphicsEnum.CURSOR_GRAB]: graphics.op.removeColor(grabGfx, COLOR_MAGENTA),
      [GraphicsEnum.CURSOR_GRAB_MASK]: graphics.op.extractColor(grabGfx, COLOR_MAGENTA),

      [GraphicsEnum.BADGE_MASK]: await graphics.loader.imageBitmapFromSrc(badgeMask),
      [GraphicsEnum.BADGE_OVERLAY_ACTIVE]: await graphics.loader.imageBitmapFromSrc(badgeOver),
      [GraphicsEnum.BADGE_OVERLAY_IDLE]: await graphics.loader.imageBitmapFromSrc(badgeOverIdle),

      [GraphicsEnum.BADGE_ANON_ACTIVE]: await graphics.loader.dataUrlFromSrc(badgeAnon),
      [GraphicsEnum.BADGE_ANON_IDLE]: await graphics.loader.dataUrlFromSrc(badgeAnonIdle),

      [GraphicsEnum.PIECE_STENCILS_SPRITESHEET]: await graphics.loader.imageBitmapFromSrc(stencilsDefault),
    }
  }
}
