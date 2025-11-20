import type { Assets } from './Assets'
import { EncodedPlayerIdx } from '../../common/src/Types'
import type { EncodedPlayer, ImageDataURL } from '../../common/src/Types'
import type { Graphics } from './Graphics'
import { GraphicsEnum } from '../../common/src/Constants'

export class PlayerCursors
{
  private cursorImages: Record<string, HTMLCanvasElement> = {}

  private cursorDown: ImageDataURL | null = null
  private cursor: ImageDataURL | null = null
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
    this.CURSOR_W = assets.Gfx[GraphicsEnum.CURSOR_GRAB].width
    this.CURSOR_W_2 = Math.round(this.CURSOR_W / 2)
    this.CURSOR_H = assets.Gfx[GraphicsEnum.CURSOR_GRAB].height
    this.CURSOR_H_2 = Math.round(this.CURSOR_H / 2)
  }

  public get (p: EncodedPlayer): HTMLCanvasElement {
    const color = p[EncodedPlayerIdx.COLOR] || '#ffffff'
    const key = color + ' ' + p[EncodedPlayerIdx.MOUSEDOWN]
    if (!this.cursorImages[key]) {
      const cursor = p[EncodedPlayerIdx.MOUSEDOWN] ? this.assets.Gfx[GraphicsEnum.CURSOR_GRAB] : this.assets.Gfx[GraphicsEnum.CURSOR_HAND]
      const mask = p[EncodedPlayerIdx.MOUSEDOWN] ? this.assets.Gfx[GraphicsEnum.CURSOR_GRAB_MASK] : this.assets.Gfx[GraphicsEnum.CURSOR_HAND_MASK]
      this.cursorImages[key] = this.graphics.op.colorize(cursor, mask, color)
    }
    return this.cursorImages[key]
  }

  public updatePlayerCursorState(d: boolean) {
    this.cursorState = d
    if (d && this.cursorDown) {
      this.canvas.style.cursor = `url('${this.cursorDown}') ${this.CURSOR_W_2} ${this.CURSOR_H_2}, grab`
    } else if (this.cursor) {
      this.canvas.style.cursor = `url('${this.cursor}') ${this.CURSOR_W_2} ${this.CURSOR_H_2}, default`
    }
  }

  public updatePlayerCursorColor(color: string) {
    this.cursorDown = this.graphics.op.colorize(this.assets.Gfx[GraphicsEnum.CURSOR_GRAB], this.assets.Gfx[GraphicsEnum.CURSOR_GRAB_MASK], color).toDataURL() as ImageDataURL
    this.cursor = this.graphics.op.colorize(this.assets.Gfx[GraphicsEnum.CURSOR_HAND], this.assets.Gfx[GraphicsEnum.CURSOR_HAND_MASK], color).toDataURL() as ImageDataURL
    this.updatePlayerCursorState(this.cursorState)
  }
}
