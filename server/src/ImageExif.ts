import exif from 'exif'

export class ImageExif {
  public getOrientation(imagePath: string): Promise<number> {
    return new Promise((resolve) => {
      new exif.ExifImage({ image: imagePath }, (error, exifData) => {
        if (error) {
          resolve(0)
        } else {
          resolve(exifData.image.Orientation || 0)
        }
      })
    })
  }
}
