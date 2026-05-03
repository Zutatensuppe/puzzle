import type { UserId, UserSettings, UserSettingsRow } from '@common/Types'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { UsersRepo } from './repo/UsersRepo'
import UserSettingsCache from './in-memory/UserSettingsCache'

describe('UsersRepo.getUserSettings', () => {
  let mockDb: any
  let repo: UsersRepo

  beforeEach(() => {
    mockDb = { get: vi.fn(), upsert: vi.fn().mockResolvedValue(undefined) }
    repo = new UsersRepo(mockDb)
    UserSettingsCache.invalidateAll()
  })

  it('returns defaults when no row exists', async () => {
    mockDb.get.mockResolvedValue(null)
    const settings = await repo.getUserSettings(1 as UserId)
    expect(settings).toEqual({
      userId: 1,
      avatarId: null,
      nsfwActive: false,
      nsfwUnblurred: false,
      hideAiImages: false,
    })
  })

  it('maps all fields from a DB row', async () => {
    const row: UserSettingsRow = {
      user_id: 7 as UserId,
      avatar_id: 99 as any,
      nsfw_active: true,
      nsfw_unblurred: true,
      hide_ai_images: true,
    }
    mockDb.get.mockResolvedValue(row)

    const settings = await repo.getUserSettings(7 as UserId)
    expect(settings).toEqual({
      userId: 7,
      avatarId: 99,
      nsfwActive: true,
      nsfwUnblurred: true,
      hideAiImages: true,
    })
  })

  it('uses cache on second call', async () => {
    const row: UserSettingsRow = {
      user_id: 3 as UserId, avatar_id: null,
      nsfw_active: false, nsfw_unblurred: false, hide_ai_images: false,
    }
    mockDb.get.mockResolvedValue(row)

    await repo.getUserSettings(3 as UserId)
    await repo.getUserSettings(3 as UserId)

    expect(mockDb.get).toHaveBeenCalledTimes(1)
  })
})

describe('UsersRepo.updateUserSettings', () => {
  let mockDb: any
  let repo: UsersRepo

  beforeEach(() => {
    mockDb = { get: vi.fn(), upsert: vi.fn().mockResolvedValue(undefined) }
    repo = new UsersRepo(mockDb)
    UserSettingsCache.invalidateAll()
  })

  it('upserts all fields to the database', async () => {
    const settings: UserSettings = {
      userId: 5 as UserId,
      avatarId: 10 as any,
      nsfwActive: true,
      nsfwUnblurred: false,
      hideAiImages: true,
    }
    await repo.updateUserSettings(settings)

    expect(mockDb.upsert).toHaveBeenCalledWith(
      'user_settings',
      { user_id: 5, avatar_id: 10, nsfw_active: true, nsfw_unblurred: false, hide_ai_images: true },
      ['user_id'],
    )
  })

  it('invalidates cache so next read fetches fresh data', async () => {
    const row: UserSettingsRow = {
      user_id: 2 as UserId, avatar_id: null,
      nsfw_active: false, nsfw_unblurred: false, hide_ai_images: false,
    }
    mockDb.get.mockResolvedValue(row)

    // populate cache
    await repo.getUserSettings(2 as UserId)
    expect(mockDb.get).toHaveBeenCalledTimes(1)

    // update invalidates
    await repo.updateUserSettings({
      userId: 2 as UserId, avatarId: null,
      nsfwActive: true, nsfwUnblurred: false, hideAiImages: true,
    })

    // next read goes to DB again
    await repo.getUserSettings(2 as UserId)
    expect(mockDb.get).toHaveBeenCalledTimes(2)
  })
})
