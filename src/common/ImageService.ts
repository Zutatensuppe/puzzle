import { Rect } from "./Geometry"
import Util from "./Util"

export const resizeUrl = (imageUrl: string, w: number, h: number, fit: string) => {
  return imageUrl
    .replace('uploads/', 'image-service/image/')
    .replace(/\?.*/, '')
    + Util.asQueryArgs({ w, h, fit })
}

export const cropUrl = (imageUrl: string, crop: Rect) => {
  return imageUrl
    .replace('/uploads/', '/image-service/image/')
    .replace(/\?.*/, '')
    + Util.asQueryArgs(crop)
}
