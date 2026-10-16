import { describe, expect, it } from 'vitest'
import { atlasLayout } from './AtlasLayout'

// pieces as created by common/src/Puzzle.ts: 64 px, half a piece of margin on each side
const puzzleInfo = (tilesX: number, tilesY: number) => ({
  tilesX,
  tilesY,
  tileSize: 64,
  tileMarginWidth: 32,
  tileDrawSize: 128,
})

describe('AtlasLayout.ts', () => {
  it('puts a single piece on one page of its draw area size', () => {
    expect(atlasLayout(puzzleInfo(1, 1))).toEqual({
      pages: [{ parityClass: 0, x: -32, y: -32, w: 128, h: 128 }],
      slots: [{ page: 0, x: 0, y: 0, size: 128 }],
    })
  })

  it('splits the classes of a 1014-piece puzzle into 24 pages of at most 8×8 slots', () => {
    // 39×26: classes of 20×13, 19×13, 20×13 and 19×13 slots, 3×2 pages each
    const layout = atlasLayout(puzzleInfo(39, 26))
    expect(layout.pages).toHaveLength(24)
    expect(layout.pages.filter(page => page.w === 1024 && page.h === 1024)).toHaveLength(8)
  })

  ;[
    { tilesX: 1, tilesY: 1 },
    { tilesX: 2, tilesY: 1 },
    { tilesX: 1, tilesY: 3 },
    { tilesX: 39, tilesY: 26 },
    { tilesX: 26, tilesY: 39 },
    { tilesX: 78, tilesY: 13 },
    { tilesX: 13, tilesY: 78 },
    { tilesX: 1014, tilesY: 1 },
  ].forEach(({ tilesX, tilesY }) => describe(`${tilesX}×${tilesY} pieces`, () => {
    const info = puzzleInfo(tilesX, tilesY)
    const layout = atlasLayout(info)

    it('gives every piece exactly one slot on an existing page', () => {
      expect(layout.slots).toHaveLength(tilesX * tilesY)
      for (const slot of layout.slots) {
        expect(layout.pages[slot.page]).toBeDefined()
      }
    })

    it('keeps every page within 1024×1024 px', () => {
      for (const page of layout.pages) {
        expect(page.w).toBeGreaterThan(0)
        expect(page.h).toBeGreaterThan(0)
        expect(page.w).toBeLessThanOrEqual(1024)
        expect(page.h).toBeLessThanOrEqual(1024)
      }
    })

    it('maps each slot to its piece\'s draw area in the puzzle and parity class', () => {
      layout.slots.forEach((slot, pieceIdx) => {
        const column = pieceIdx % tilesX
        const row = Math.floor(pieceIdx / tilesX)
        const page = layout.pages[slot.page]
        expect(page.parityClass).toBe((row % 2) * 2 + column % 2)
        expect(slot.size).toBe(128)
        expect(page.x + slot.x).toBe(column * 64 - 32)
        expect(page.y + slot.y).toBe(row * 64 - 32)
      })
    })

    it('places slots inside their page without overlapping each other', () => {
      const slotsByPage = new Map<number, typeof layout.slots>()
      for (const slot of layout.slots) {
        const page = layout.pages[slot.page]
        expect(slot.x).toBeGreaterThanOrEqual(0)
        expect(slot.y).toBeGreaterThanOrEqual(0)
        expect(slot.x + slot.size).toBeLessThanOrEqual(page.w)
        expect(slot.y + slot.size).toBeLessThanOrEqual(page.h)
        slotsByPage.set(slot.page, [...(slotsByPage.get(slot.page) ?? []), slot])
      }
      for (const slots of slotsByPage.values()) {
        for (let i = 0; i < slots.length; i++) {
          for (let j = i + 1; j < slots.length; j++) {
            const a = slots[i]
            const b = slots[j]
            const overlap = a.x < b.x + b.size && b.x < a.x + a.size && a.y < b.y + b.size && b.y < a.y + a.size
            expect(overlap).toBe(false)
          }
        }
      }
    })

    it('leaves no page empty', () => {
      const usedPages = new Set(layout.slots.map(slot => slot.page))
      expect(usedPages.size).toBe(layout.pages.length)
    })
  }))
})
