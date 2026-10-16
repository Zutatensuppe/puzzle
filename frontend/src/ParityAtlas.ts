/**
 * The canvas renderer's piece pipeline for Animated Images (ADR-0001).
 *
 * Per game, each page of each parity class (see AtlasLayout.ts) is one atlas
 * sheet plus one mask sheet. The mask sheet is stamped once from the piece
 * shape masks. On each Frame change every atlas sheet is rebuilt with a
 * constant number of full-sheet operations: clear, draw the scaled Frame at
 * the page offset, keep only the masked piece areas. The atlas holds the
 * masked image only. The bevel shading is drawn per piece from the shape
 * sheets, unrotated, so it stays screen-aligned.
 */

import type { PuzzleInfo } from '@common/Types'
import { atlasLayout } from './AtlasLayout'
import type { Graphics } from './Graphics'
import type { PieceShapeSheets } from './PuzzleGraphics'

interface ParityAtlasPage {
  /** puzzle coordinates of the page's top left corner */
  x: number
  y: number
  sheet: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  mask: HTMLCanvasElement
}

export interface ParityAtlasSource {
  sheet: HTMLCanvasElement
  x: number
  y: number
  size: number
}

export class ParityAtlas {
  private constructor(
    private readonly puzzleDim: { w: number, h: number },
    private readonly pages: ParityAtlasPage[],
    private readonly sources: ParityAtlasSource[],
  ) {}

  static create(
    info: PuzzleInfo,
    shapeSheets: PieceShapeSheets,
    graphics: Graphics,
  ): ParityAtlas {
    const layout = atlasLayout(info)
    const pages = layout.pages.map(page => {
      const sheet = graphics.createCanvas(page.w, page.h)
      return {
        x: page.x,
        y: page.y,
        sheet,
        ctx: sheet.getContext('2d')!,
        mask: graphics.createCanvas(page.w, page.h),
      }
    })
    const maskCtxs = pages.map(page => page.mask.getContext('2d')!)
    layout.slots.forEach((slot, pieceIdx) => {
      const pos = shapeSheets.positions[info.shapes[pieceIdx]]
      maskCtxs[slot.page].drawImage(
        shapeSheets.mask,
        pos.x, pos.y, slot.size, slot.size,
        slot.x, slot.y, slot.size, slot.size,
      )
    })
    const sources = layout.slots.map(slot => ({
      sheet: pages[slot.page].sheet,
      x: slot.x,
      y: slot.y,
      size: slot.size,
    }))
    return new ParityAtlas({ w: info.width, h: info.height }, pages, sources)
  }

  /** Rebuilds every atlas sheet from `frame`, which is scaled to the puzzle size. */
  update(frame: CanvasImageSource): void {
    for (const page of this.pages) {
      const ctx = page.ctx
      ctx.globalCompositeOperation = 'source-over'
      ctx.clearRect(0, 0, page.sheet.width, page.sheet.height)
      ctx.drawImage(frame, -page.x, -page.y, this.puzzleDim.w, this.puzzleDim.h)
      ctx.globalCompositeOperation = 'destination-in'
      ctx.drawImage(page.mask, 0, 0)
      ctx.globalCompositeOperation = 'source-over'
    }
  }

  /** Where the draw area of a piece is found in the atlas. */
  source(pieceIdx: number): ParityAtlasSource {
    return this.sources[pieceIdx]
  }
}
