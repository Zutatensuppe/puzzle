import { Rect } from "./Geometry"
import Util from "./Util"

export const resizeUrl = (imageUrl: string, w: number, h: number, fit: string) => {
  return imageUrl
    .replace('uploads/', 'image-service/image/')
    .replace(/\?.*/, '')
    + Util.asQueryArgs({ mode: 'resize', w, h, fit })
}

export const restrictSizeUrl = (imageUrl: string, w: number, h: number) => {
  return imageUrl
    .replace('uploads/', 'image-service/image/')
    .replace(/\?.*/, '')
    + Util.asQueryArgs({ mode: 'restrict', w, h })
}

export const cropUrl = (imageUrl: string, crop: Rect) => {
  return imageUrl
    .replace('/uploads/', '/image-service/image/')
    .replace(/\?.*/, '')
    + Util.asQueryArgs(Object.assign({}, { mode: 'cropRestrict', mw: 1920, mh: 1920 }, crop))
}
