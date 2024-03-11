import {
  AssetsInterface,
  GraphicsInterface,
  Player,
  PlayerCursorsInterface,
} from './Types'

export class PlayerCursors implements PlayerCursorsInterface
{
  private cursorImages: Record<string, ImageBitmap | HTMLCanvasElement> = {}

  private cursorDown: string = ''
  private cursor: string = ''
  private cursorState: boolean = false

  public readonly CURSOR_W: number
  public readonly CURSOR_W_2: number
  public readonly CURSOR_H: number
  public readonly CURSOR_H_2: number

  constructor(
    private canvas: HTMLCanvasElement,
    private assets: AssetsInterface,
    private graphics: GraphicsInterface,
  ) {
    // all cursors must be of the same dimensions
    this.CURSOR_W = assets.Gfx.GRAB.width
    this.CURSOR_W_2 = Math.round(this.CURSOR_W / 2)
    this.CURSOR_H = assets.Gfx.GRAB.height
    this.CURSOR_H_2 = Math.round(this.CURSOR_H / 2)
  }

  async get (p: Player): Promise<ImageBitmap | HTMLCanvasElement> {
    const key = p.color + ' ' + p.d
    if (!this.cursorImages[key]) {
      const cursor = p.d ? this.assets.Gfx.GRAB : this.assets.Gfx.HAND
      if (p.color) {
        const mask = p.d ? this.assets.Gfx.GRAB_MASK : this.assets.Gfx.HAND_MASK
        this.cursorImages[key] = this.graphics.colorizedCanvas(cursor, mask, p.color)
      } else {
        this.cursorImages[key] = cursor
      }
    }
    return this.cursorImages[key]
  }

  updatePlayerCursorState(d: boolean) {
    this.cursorState = d
    const [url, fallback] = d ? [this.cursorDown, 'grab'] : [this.cursor, 'default']
    this.canvas.style.cursor = `url('${url}') ${this.CURSOR_W_2} ${this.CURSOR_H_2}, ${fallback}`
  }

  updatePlayerCursorColor(color: string) {
    this.cursorDown = this.graphics.colorizedCanvas(this.assets.Gfx.GRAB, this.assets.Gfx.GRAB_MASK, color).toDataURL()
    this.cursor = this.graphics.colorizedCanvas(this.assets.Gfx.HAND, this.assets.Gfx.HAND_MASK, color).toDataURL()
    this.updatePlayerCursorState(this.cursorState)
  }
}
