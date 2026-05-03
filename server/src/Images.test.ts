import type { ImageId, ImageRowWithCount, JSONDateString, TagId, TagRowWithCount, UserId } from '@common/Types'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { Images } from './Images'
import type { ImagesRepo } from './repo/ImagesRepo'
import type { ImageExif } from './ImageExif'
import config from './Config'

const createMockRow = (overrides: Partial<ImageRowWithCount> = {}): ImageRowWithCount => ({
  id: 1 as ImageId,
  uploader_user_id: 100 as UserId,
  uploader_user_name: 'testuser',
  created: '2024-01-01T00:00:00.000Z' as JSONDateString,
  filename: 'test.jpg',
  filename_original: 'original.jpg',
  title: 'Test Image',
  width: 800,
  height: 600,
  private: 0,
  copyright_name: 'Author',
  copyright_url: 'https://example.com',
  reported: 2,
  nsfw: 0,
  ai_generated: 0,
  checksum: 'abc123',
  state: 'approved',
  reject_reason: '',
  games_count: 5,
  ...overrides,
})

describe('Images.imagesByIdsFromDb', () => {
  let images: Images
  let mockImagesRepo: any

  beforeEach(() => {
    mockImagesRepo = {
      getImagesWithCountByIds: vi.fn(),
      getTagsByImageIds: vi.fn().mockResolvedValue({}),
    }
    images = new Images(mockImagesRepo as unknown as ImagesRepo, {} as ImageExif)
  })

  it('maps a row to ImageInfo with all fields', async () => {
    const row = createMockRow({
      id: 42 as ImageId,
      private: 1,
      nsfw: 1,
      ai_generated: 1,
      state: 'pending_approval',
      reject_reason: 'blurry',
    })
    mockImagesRepo.getImagesWithCountByIds.mockResolvedValue([row])

    const [result] = await images.imagesByIdsFromDb([42 as ImageId])

    expect(result).toEqual({
      id: 42,
      uploaderUserId: 100,
      uploaderName: 'testuser',
      filename: 'test.jpg',
      url: `${config.dir.UPLOAD_URL}/test.jpg`,
      title: 'Test Image',
      tags: [],
      created: new Date('2024-01-01T00:00:00.000Z').getTime(),
      width: 800,
      height: 600,
      private: true,
      gameCount: 5,
      copyrightName: 'Author',
      copyrightURL: 'https://example.com',
      reported: 2,
      nsfw: true,
      aiGenerated: true,
      state: 'pending_approval',
      rejectReason: 'blurry',
    })
  })

  it('maps integer 0 to false and 1 to true for boolean fields', async () => {
    const row = createMockRow({ private: 0, nsfw: 0, ai_generated: 0 })
    mockImagesRepo.getImagesWithCountByIds.mockResolvedValue([row])

    const [result] = await images.imagesByIdsFromDb([1 as ImageId])

    expect(result.private).toBe(false)
    expect(result.nsfw).toBe(false)
    expect(result.aiGenerated).toBe(false)
  })

  it('resolves tags for the image', async () => {
    const row = createMockRow({ id: 10 as ImageId })
    const tags: Record<number, TagRowWithCount[]> = {
      10: [
        { id: 1 as TagId, slug: 'nature', title: 'Nature', images_count: 0 },
        { id: 2 as TagId, slug: 'photo', title: 'Photo', images_count: 0 },
      ],
    }
    mockImagesRepo.getImagesWithCountByIds.mockResolvedValue([row])
    mockImagesRepo.getTagsByImageIds.mockResolvedValue(tags)

    const [result] = await images.imagesByIdsFromDb([10 as ImageId])

    expect(result.tags).toEqual([
      { id: 1, slug: 'nature', title: 'Nature', total: 0 },
      { id: 2, slug: 'photo', title: 'Photo', total: 0 },
    ])
  })

  it('returns empty array when no rows found', async () => {
    mockImagesRepo.getImagesWithCountByIds.mockResolvedValue([])
    mockImagesRepo.getTagsByImageIds.mockResolvedValue({})

    const result = await images.imagesByIdsFromDb([999 as ImageId])

    expect(result).toEqual([])
  })

  it('uses empty uploader name as null', async () => {
    const row = createMockRow({ uploader_user_name: '' })
    mockImagesRepo.getImagesWithCountByIds.mockResolvedValue([row])

    const [result] = await images.imagesByIdsFromDb([1 as ImageId])

    expect(result.uploaderName).toBeNull()
  })
})

describe('ImagesRepo.searchImagesWithCount - SQL filtering', () => {
  const createRepo = async () => {
    const mockDb = {
      _getMany: vi.fn().mockResolvedValue([]),
      _buildOrderBy: vi.fn().mockReturnValue(''),
      _buildLimit: vi.fn().mockReturnValue(''),
    }
    const { ImagesRepo } = await import('./repo/ImagesRepo')
    return { repo: new ImagesRepo(mockDb as any), mockDb }
  }

  const testCases: {
    name: string
    userId: UserId | null
    showNsfw: boolean
    hideAiImages: boolean
    shouldContain: string[]
    shouldNotContain: string[]
  }[] = [
    {
      name: 'no content filters when all are permissive',
      userId: null, showNsfw: true, hideAiImages: false,
      shouldContain: [],
      shouldNotContain: ['i.nsfw', 'ai_generated'],
    },
    {
      name: 'hides nsfw for anonymous user',
      userId: null, showNsfw: false, hideAiImages: false,
      shouldContain: ['i.nsfw = 0'],
      shouldNotContain: ['ai_generated'],
    },
    {
      name: 'hides ai-generated for anonymous user',
      userId: null, showNsfw: true, hideAiImages: true,
      shouldContain: ['i.ai_generated = 0'],
      shouldNotContain: ['i.nsfw'],
    },
    {
      name: 'allows own content when logged in and both filters active',
      userId: 10 as UserId, showNsfw: false, hideAiImages: true,
      shouldContain: ['i.nsfw = 0 OR i.uploader_user_id', 'i.ai_generated = 0 OR i.uploader_user_id'],
      shouldNotContain: [],
    },
  ]

  testCases.forEach(({ name, userId, showNsfw, hideAiImages, shouldContain, shouldNotContain }) => {
    it(name, async () => {
      const { repo, mockDb } = await createRepo()
      await repo.searchImagesWithCount('', 'date_desc', 0, 10, userId, null, showNsfw, hideAiImages)

      const sql = mockDb._getMany.mock.calls[0][0] as string
      for (const fragment of shouldContain) {
        expect(sql).toContain(fragment)
      }
      for (const fragment of shouldNotContain) {
        expect(sql).not.toContain(fragment)
      }
    })
  })

  it('returns empty for invalid orderBy', async () => {
    const { repo } = await createRepo()
    const result = await repo.searchImagesWithCount('', 'invalid_sort', 0, 10, null, null, true, false)
    expect(result).toEqual([])
  })
})
