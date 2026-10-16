/**
 * Layout of the canvas renderer's parity atlases.
 *
 * Pieces are split into four parity classes by (column mod 2, row mod 2).
 * Within one class the draw areas of the pieces (piece plus half a piece of
 * margin on each side, so twice the piece size) tile the puzzle without
 * overlapping. A class is therefore simply the puzzle image drawn at a class
 * offset, and no slot ever contains a neighbour's tab.
 *
 * Each class is split into pages of at most `maxPageSize` px per side, because
 * larger canvases drop off Chromium's fast GPU path (ADR-0001).
 */

import type { PuzzleInfo } from '@common/Types'

export const MAX_ATLAS_PAGE_SIZE = 1024

export type AtlasLayoutPuzzleInfo = Pick<PuzzleInfo, 'tilesX' | 'tilesY' | 'tileSize' | 'tileMarginWidth' | 'tileDrawSize'>

export interface AtlasPage {
  /** (row mod 2) * 2 + (column mod 2) of all pieces on this page */
  parityClass: number
  /** puzzle coordinates of the page's top left corner */
  x: number
  y: number
  w: number
  h: number
}

export interface AtlasSlot {
  /** index into `AtlasLayout.pages` */
  page: number
  /** top left corner of the piece's draw area on its page */
  x: number
  y: number
  size: number
}

export interface AtlasLayout {
  pages: AtlasPage[]
  /** indexed by piece index */
  slots: AtlasSlot[]
}

export const atlasLayout = (
  info: AtlasLayoutPuzzleInfo,
  maxPageSize: number = MAX_ATLAS_PAGE_SIZE,
): AtlasLayout => {
  const drawSize = info.tileDrawSize
  const slotsPerPage = Math.max(1, Math.floor(maxPageSize / drawSize))

  const pages: AtlasPage[] = []
  // per parity class: page index by [page row][page column]
  const pageGrids: number[][][] = []
  for (let parityClass = 0; parityClass < 4; parityClass++) {
    const classX = parityClass & 1
    const classY = parityClass >> 1
    const classSlotsX = Math.ceil((info.tilesX - classX) / 2)
    const classSlotsY = Math.ceil((info.tilesY - classY) / 2)
    const grid: number[][] = []
    for (let slotY = 0; slotY < classSlotsY; slotY += slotsPerPage) {
      const row: number[] = []
      for (let slotX = 0; slotX < classSlotsX; slotX += slotsPerPage) {
        row.push(pages.length)
        pages.push({
          parityClass,
          x: classX * info.tileSize - info.tileMarginWidth + slotX * drawSize,
          y: classY * info.tileSize - info.tileMarginWidth + slotY * drawSize,
          w: Math.min(slotsPerPage, classSlotsX - slotX) * drawSize,
          h: Math.min(slotsPerPage, classSlotsY - slotY) * drawSize,
        })
      }
      grid.push(row)
    }
    pageGrids.push(grid)
  }

  const slots: AtlasSlot[] = []
  for (let pieceIdx = 0; pieceIdx < info.tilesX * info.tilesY; pieceIdx++) {
    const column = pieceIdx % info.tilesX
    const row = Math.floor(pieceIdx / info.tilesX)
    const parityClass = (row & 1) * 2 + (column & 1)
    // slot position within the class
    const slotX = column >> 1
    const slotY = row >> 1
    const pageX = Math.floor(slotX / slotsPerPage)
    const pageY = Math.floor(slotY / slotsPerPage)
    slots.push({
      page: pageGrids[parityClass][pageY][pageX],
      x: (slotX - pageX * slotsPerPage) * drawSize,
      y: (slotY - pageY * slotsPerPage) * drawSize,
      size: drawSize,
    })
  }

  return { pages, slots }
}
