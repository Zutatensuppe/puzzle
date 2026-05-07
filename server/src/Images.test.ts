import type { ImageId, ImageRowWithCount, JSONDateString, TagId, TagRowWithCount, UserId } from '@common/Types'
import { ImageState } from '@common/Types'
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
  state: ImageState.Approved,
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
      state: ImageState.PendingApproval,
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
      state: ImageState.PendingApproval,
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

describe('Images.setTags', () => {
  let images: Images
  let mockImagesRepo: any

  beforeEach(() => {
    mockImagesRepo = {
      deleteTagRelations: vi.fn(),
      upsertTag: vi.fn().mockImplementation(({ slug }: { slug: string }) => {
        const map: Record<string, number> = { nature: 1, photo: 2, art: 3 }
        return Promise.resolve((map[slug] ?? 99) as TagId)
      }),
      insertTagRelationIfNotExists: vi.fn(),
    }
    images = new Images(mockImagesRepo as unknown as ImagesRepo, {} as ImageExif)
  })

  it('calls deleteTagRelations with adminMode=false by default', async () => {
    await images.setTags(10 as ImageId, ['nature'])
    expect(mockImagesRepo.deleteTagRelations).toHaveBeenCalledWith(10, false)
  })

  it('calls deleteTagRelations with adminMode=true when specified', async () => {
    await images.setTags(10 as ImageId, ['nature'], true)
    expect(mockImagesRepo.deleteTagRelations).toHaveBeenCalledWith(10, true)
  })

  it('inserts tags via insertTagRelationIfNotExists', async () => {
    await images.setTags(10 as ImageId, ['nature', 'photo'])
    expect(mockImagesRepo.insertTagRelationIfNotExists).toHaveBeenCalledTimes(2)
    expect(mockImagesRepo.insertTagRelationIfNotExists).toHaveBeenCalledWith(10, 1)
    expect(mockImagesRepo.insertTagRelationIfNotExists).toHaveBeenCalledWith(10, 2)
  })

  it('skips tag if upsertTag returns falsy', async () => {
    mockImagesRepo.upsertTag.mockResolvedValue(0)
    await images.setTags(10 as ImageId, ['anything'])
    expect(mockImagesRepo.insertTagRelationIfNotExists).not.toHaveBeenCalled()
  })
})

describe('ImagesRepo.deleteTagRelations', () => {
  it('deletes all tags in admin mode', async () => {
    const mockDb = {
      delete: vi.fn(),
      run: vi.fn(),
    }
    const { ImagesRepo } = await import('./repo/ImagesRepo')
    const repo = new ImagesRepo(mockDb as any)

    await repo.deleteTagRelations(5 as ImageId, true)
    expect(mockDb.delete).toHaveBeenCalledWith('image_x_category', { image_id: 5 })
    expect(mockDb.run).not.toHaveBeenCalled()
  })

  it('only deletes unconfirmed tags in user mode', async () => {
    const mockDb = {
      delete: vi.fn(),
      run: vi.fn(),
    }
    const { ImagesRepo } = await import('./repo/ImagesRepo')
    const repo = new ImagesRepo(mockDb as any)

    await repo.deleteTagRelations(5 as ImageId, false)
    expect(mockDb.delete).not.toHaveBeenCalled()
    expect(mockDb.run).toHaveBeenCalledWith(
      expect.stringContaining('confirmed = false'),
      [5],
    )
  })
})

describe('ImagesRepo.insertCurationEvent', () => {
  it('inserts a curation event row', async () => {
    const mockDb = {
      insert: vi.fn(),
    }
    const { ImagesRepo } = await import('./repo/ImagesRepo')
    const repo = new ImagesRepo(mockDb as any)

    await repo.insertCurationEvent({
      image_id: 42 as ImageId,
      user_id: 1 as UserId,
      topic: 'nsfw',
      decision: 'yes',
    })

    expect(mockDb.insert).toHaveBeenCalledWith('curation_events', {
      image_id: 42,
      user_id: 1,
      topic: 'nsfw',
      decision: 'yes',
    })
  })
})

describe('ImagesRepo.getNextForCuration', () => {
  it('passes topic and maxPasses to the query', async () => {
    const mockDb = {
      _get: vi.fn().mockResolvedValue(null),
      _getMany: vi.fn().mockResolvedValue([]),
      _buildWhere: vi.fn().mockReturnValue({ sql: 'WHERE 1=1', values: [] }),
    }
    const { ImagesRepo } = await import('./repo/ImagesRepo')
    const repo = new ImagesRepo(mockDb as any)

    const result = await repo.getNextForCuration('ai_generated', 2)

    // First _get call is for stats
    expect(mockDb._get.mock.calls[0][1]).toContain(2) // maxPasses
    expect(mockDb._get.mock.calls[0][1]).toContain('ai_generated') // topic
    expect(result.image).toBeNull()
    expect(result.progress).toEqual({ reviewed: 0, total: 0 })
  })

  it('returns image with tags and topic_value when found', async () => {
    const imageRow = createMockRow({ id: 7 as ImageId, ai_generated: 1 })
    const mockDb = {
      _get: vi.fn()
        .mockResolvedValueOnce({ reviewed: 3, total: 10 }) // stats
        .mockResolvedValueOnce(imageRow) // image
        .mockResolvedValueOnce(null), // getTopicValue tag lookup (won't be called for ai_generated)
      _getMany: vi.fn().mockResolvedValue([]), // getTagsByImageIds
      _buildWhere: vi.fn().mockReturnValue({ sql: 'WHERE 1=1', values: [] }),
    }
    const { ImagesRepo } = await import('./repo/ImagesRepo')
    const repo = new ImagesRepo(mockDb as any)

    const result = await repo.getNextForCuration('ai_generated', 0)

    expect(result.progress).toEqual({ reviewed: 3, total: 10 })
    expect(result.image).not.toBeNull()
    expect(result.image!.id).toBe(7)
    expect(result.image!.topic_value).toBe(1) // ai_generated value
    expect(result.image!.tags).toEqual([])
  })
})
