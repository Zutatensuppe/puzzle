import type { Assets } from './Assets'
import { EncodedPlayerIdx } from '../../common/src/Types'
import type { EncodedPlayer } from '../../common/src/Types'
import type { Graphics } from './Graphics'

export class PlayerCursors
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
    private readonly canvas: HTMLCanvasElement,
    private readonly assets: Assets,
    private readonly graphics: Graphics,
  ) {
    // all cursors must be of the same dimensions
    this.CURSOR_W = assets.Gfx.GRAB.width
    this.CURSOR_W_2 = Math.round(this.CURSOR_W / 2)
    this.CURSOR_H = assets.Gfx.GRAB.height
    this.CURSOR_H_2 = Math.round(this.CURSOR_H / 2)
  }

  public get (p: EncodedPlayer): ImageBitmap | HTMLCanvasElement {
    const color = p[EncodedPlayerIdx.COLOR] || '#ffffff'
    const key = color + ' ' + p[EncodedPlayerIdx.MOUSEDOWN]
    if (!this.cursorImages[key]) {
      const cursor = p[EncodedPlayerIdx.MOUSEDOWN] ? this.assets.Gfx.GRAB : this.assets.Gfx.HAND
      const mask = p[EncodedPlayerIdx.MOUSEDOWN] ? this.assets.Gfx.GRAB_MASK : this.assets.Gfx.HAND_MASK
      this.cursorImages[key] = this.graphics.colorizedCanvas(cursor, mask, color)
    }
    return this.cursorImages[key]
  }

  public updatePlayerCursorState(d: boolean) {
    this.cursorState = d
    if (d) {
      this.canvas.style.cursor = `url('${this.cursorDown}') ${this.CURSOR_W_2} ${this.CURSOR_H_2}, grab`
    } else {
      this.canvas.style.cursor = `url('${this.cursor}') ${this.CURSOR_W_2} ${this.CURSOR_H_2}, default`
    }
  }

  public updatePlayerCursorColor(color: string) {
    this.cursorDown = this.graphics.colorizedCanvas(this.assets.Gfx.GRAB, this.assets.Gfx.GRAB_MASK, color).toDataURL()
    this.cursor = this.graphics.colorizedCanvas(this.assets.Gfx.HAND, this.assets.Gfx.HAND_MASK, color).toDataURL()
    this.updatePlayerCursorState(this.cursorState)
  }
}
