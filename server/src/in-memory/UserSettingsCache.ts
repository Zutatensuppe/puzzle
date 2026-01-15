import type { UserId, UserSettings } from '@common/Types'

class UserSettingsCache {
  private cache = new Map<UserId, UserSettings>()

  get(userId: UserId): UserSettings | null {
    return this.cache.get(userId) || null
  }

  set(userId: UserId, settings: UserSettings): void {
    this.cache.set(userId, settings)
  }

  invalidate(userId: UserId): void {
    this.cache.delete(userId)
  }

  invalidateAll(): void {
    this.cache.clear()
  }
}

export default new UserSettingsCache()
