import type { UserId } from '@common/Types'
import { describe, expect, it, vi } from 'vitest'
import { Users } from './Users'
import type { Repos } from './repo/Repos'
import type { Images } from './Images'
import type { GameService } from './GameService'

describe('Users.getCompleteUserSettings', () => {
  const createUsers = (settings: { nsfwActive: boolean, nsfwUnblurred: boolean, hideAiImages: boolean }, avatar: any = null) => {
    const mockRepos = {
      users: {
        getUserSettings: vi.fn().mockResolvedValue({
          userId: 1 as UserId,
          avatarId: avatar ? 10 : null,
          ...settings,
        }),
        getUserAvatarByUserId: vi.fn().mockResolvedValue(avatar),
      },
    } as unknown as Repos
    return new Users({} as any, mockRepos, {} as Images, {} as GameService)
  }

  it('returns complete settings with no avatar', async () => {
    const users = createUsers({ nsfwActive: true, nsfwUnblurred: false, hideAiImages: true })
    const result = await users.getCompleteUserSettings(1 as UserId)

    expect(result).toEqual({
      userId: 1,
      avatarId: null,
      avatar: null,
      nsfwActive: true,
      nsfwUnblurred: false,
      hideAiImages: true,
    })
  })

  it('includes avatar when user has one', async () => {
    const avatar = { id: 10, url: '/avatars/pic.jpg', filename: 'pic.jpg' }
    const users = createUsers({ nsfwActive: false, nsfwUnblurred: false, hideAiImages: false }, avatar)
    const result = await users.getCompleteUserSettings(1 as UserId)

    expect(result.avatar).toEqual(avatar)
    expect(result.avatarId).toBe(10)
  })
})
