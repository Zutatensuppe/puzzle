import Graphics from "./Graphics"

// @ts-ignore We can ignore typescript for for binary file includes
const images = import.meta.globEager('./assets/gfx/*.png')

// @ts-ignore We can ignore typescript for for binary file includes
const textures = import.meta.globEager('./assets/textures/*.{jpg,png}')

// @ts-ignore We can ignore typescript for for binary file includes
const sounds = import.meta.globEager('./assets/sounds/*.mp3')

const load = async () => {
  // TODO: parallel loading
  return {
    Audio: {
      CLICK: new Audio(sounds['./assets/sounds/click.mp3'].default),
      CLICK_2: new Audio(sounds['./assets/sounds/click2.mp3'].default),
    },
    Gfx: {
      GRAB: await Graphics.loadImageToBitmap(images['./assets/gfx/grab.png'].default),
      HAND: await Graphics.loadImageToBitmap(images['./assets/gfx/hand.png'].default),
      GRAB_MASK: await Graphics.loadImageToBitmap(images['./assets/gfx/grab_mask.png'].default),
      HAND_MASK: await Graphics.loadImageToBitmap(images['./assets/gfx/hand_mask.png'].default),
    },
    Textures: {
      WOOD_DARK: await Graphics.loadImageToBitmap(textures['./assets/textures/wood-dark.jpg'].default),
      WOOD_LIGHT: await Graphics.loadImageToBitmap(textures['./assets/textures/wood-light.jpg'].default),
      OAK_BROWN: await Graphics.loadImageToBitmap(textures['./assets/textures/Oak-none-3275x2565mm-Architextures.jpg'].default),
    },
  }
}

export default {
  load
}
