import images from '../../src/server/Images'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { expect, it } from 'vitest'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// TODO: do this without hack
// https://github.com/prisma/prisma/issues/8558#issuecomment-1102176746
// @ts-ignore
global.setImmediate = global.setImmediate || ((fn, ...args) => global.setTimeout(fn, 0, ...args));

[
  {
    // image with CMYK instead of RGB
    // src: https://github.com/image-size/image-size/issues/37#issuecomment-114720646
    imagePath: __dirname + '/fixtures/50d6d48c-1a67-11e5-820f-2ad9c220252a.JPG',
    expected: { w: 425, h: 392 },
  },
  {
    // normal image
    imagePath: __dirname + '/fixtures/kxjfngu5gb32ad2vm39-avatar.jpeg',
    expected: { w: 203, h: 203 },
  },
].forEach(({ imagePath, expected }) => it('getDimensions', async () => {
  const actual = await images.getDimensions(imagePath)
  expect(actual).toStrictEqual(expected)
}))
