import Graphics from "./Graphics"

// @ts-ignore We can ignore typescript for for binary file includes
const images = import.meta.globEager('./assets/gfx/*.png')

// @ts-ignore We can ignore typescript for for binary file includes
const textures = import.meta.globEager('./assets/textures/*.{jpg,png}')

// @ts-ignore We can ignore typescript for for binary file includes
const sounds = import.meta.globEager('./assets/sounds/*.mp3')

export class Assets {
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

  async init () {
    // TODO: parallel loading
    this.Audio = {
      CLICK: new Audio(sounds['./assets/sounds/click.mp3'].default),
      CLICK_2: new Audio(sounds['./assets/sounds/click2.mp3'].default),
    }

    this.Gfx = {
      GRAB: await Graphics.loadImageToBitmap(images['./assets/gfx/grab.png'].default),
      HAND: await Graphics.loadImageToBitmap(images['./assets/gfx/hand.png'].default),
      GRAB_MASK: await Graphics.loadImageToBitmap(images['./assets/gfx/grab_mask.png'].default),
      HAND_MASK: await Graphics.loadImageToBitmap(images['./assets/gfx/hand_mask.png'].default),
    }

    this.Textures = {
      WOOD_DARK: await Graphics.loadImageToBitmap(textures['./assets/textures/wood-dark.jpg'].default),
      WOOD_LIGHT: await Graphics.loadImageToBitmap(textures['./assets/textures/wood-light.jpg'].default),
      OAK_BROWN: await Graphics.loadImageToBitmap(textures['./assets/textures/Oak-none-3275x2565mm-Architextures.jpg'].default),
    }
  }
}
