'use strict'

import type { ImageDataURL } from '@common/Types'
import type { Graphics } from './Graphics'

export interface GraphicsLoaderInterface {
  blobFromFile(file: File): Promise<Blob>
  blobFromDataUrl(dataUrl: ImageDataURL): Blob
  blobFromSrc(src: string): Promise<Blob>
  imageBitmapFromSrc(src: string): Promise<ImageBitmap>
  canvasFromSrc(src: string): Promise<HTMLCanvasElement>
  dataUrlFromSrc(src: string): Promise<ImageDataURL>
  dataUrlFromBlob(blob: Blob): Promise<ImageDataURL>
  imageBitmapFromCanvas(canvas: HTMLCanvasElement): Promise<ImageBitmap>
  imageBitmapFromBlob(blob: Blob): Promise<ImageBitmap>
}

export class GraphicsLoader implements GraphicsLoaderInterface {
  public constructor(
    private readonly gfx: Graphics,
  ) { }

  public blobFromFile(file: File): Promise<Blob> {
    return new Promise<Blob>((resolve, reject) => {
      const r = new FileReader()
      r.readAsDataURL(file)
      r.onload = (ev: ProgressEvent<FileReader>) => {
        if (!ev.target || !ev.target.result || typeof ev.target.result !== 'string') {
          reject(new Error('Could not read file'))
          return
        }
        try {
          resolve(this.blobFromDataUrl(ev.target.result as ImageDataURL))
        } catch (e) {
          reject(e)
        }
      }
      r.onerror = (ev: any) => {
        reject(ev)
      }
    })
  }

  public blobFromDataUrl(dataUrl: ImageDataURL): Blob {
    const arr = dataUrl.split(',')
    const m = arr[0].match(/:(.*?);/)
    if (!m) {
      throw new Error('dataUrlToBlob: Could not parse data url')
    }
    const mime = m[1]
    const bstr = atob(arr[1])
    let n = bstr.length
    const u8arr = new Uint8Array(n)
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n)
    }
    return new Blob([u8arr], { type: mime })
  }

  public async blobFromSrc(src: string): Promise<Blob> {
    const url = src.match(/^https?:\/\//) && src.indexOf('/api/proxy?') !== 0
      ? `/api/proxy?${new URLSearchParams({ url: src })}`
      : src
    const response = await fetch(url)
    return await response.blob()
  }

  public async imageBitmapFromSrc(src: string): Promise<ImageBitmap> {
    const blob = await this.blobFromSrc(src)
    return this.imageBitmapFromBlob(blob)
  }

  public async canvasFromSrc(src: string): Promise<HTMLCanvasElement> {
    const imageBitmap = await this.imageBitmapFromSrc(src)
    const canvas = this.gfx.createCanvas(imageBitmap.width, imageBitmap.height)
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(imageBitmap, 0, 0)
    return canvas
  }

  public async dataUrlFromSrc(src: string): Promise<ImageDataURL> {
    const canvas = await this.canvasFromSrc(src)
    return canvas.toDataURL() as ImageDataURL
  }

  public dataUrlFromBlob(blob: Blob): Promise<ImageDataURL> {
    return new Promise<ImageDataURL>((resolve, reject) => {
      const r = new FileReader()
      r.readAsDataURL(blob)
      r.onload = (ev: ProgressEvent<FileReader>) => {
        if (!ev.target || !ev.target.result || typeof ev.target.result !== 'string') {
          reject('file reader error')
          return
        }
        resolve(ev.target.result as ImageDataURL)
      }
    })
  }

  public imageBitmapFromCanvas(canvas: HTMLCanvasElement): Promise<ImageBitmap> {
    return createImageBitmap(canvas)
  }

  public imageBitmapFromBlob(blob: Blob): Promise<ImageBitmap> {
    return createImageBitmap(blob)
  }
}
