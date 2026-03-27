import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TwitchAuth } from './TwitchAuth'
import type { ClientId, UserId, UserRow } from '@common/Types'
import type { IdentityRow } from '../../repo/UserIdentityRepo'

const TWITCH_CONFIG = {
  client_id: 'test_client_id',
  client_secret: 'test_client_secret',
}

const REDIRECT_URIS = ['http://localhost:3000/api/auth/twitch/redirect_uri']

const TWITCH_USER = {
  id: 'twitch-123',
  display_name: 'TestStreamer',
  email: 'streamer@example.com',
}

function makeUserRow(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: 1 as UserId,
    created: '2024-01-01T00:00:00.000Z' as any,
    client_id: 'client-abc' as ClientId,
    name: 'TestStreamer',
    email: 'streamer@example.com',
    trusted: 0,
    trust_manually_set: 0,
    ...overrides,
  }
}

function makeIdentityRow(overrides: Partial<IdentityRow> = {}): IdentityRow {
  return {
    id: 1 as any,
    user_id: 1 as UserId,
    provider_name: 'twitch',
    provider_id: 'twitch-123',
    provider_email: 'streamer@example.com',
    ...overrides,
  }
}

function mockFetchFn(tokenOk: boolean, userOk: boolean) {
  return vi.fn<typeof fetch>().mockImplementation((url: RequestInfo | URL) => {
    const urlStr = String(url)
    if (urlStr.includes('id.twitch.tv/oauth2/token')) {
      return Promise.resolve({
        ok: tokenOk,
        json: () => Promise.resolve({
          access_token: 'mock_access_token',
          refresh_token: 'mock_refresh_token',
          expires_in: 3600,
          scope: ['openid', 'user:read:email'],
          token_type: 'bearer',
        }),
      } as Response)
    }
    if (urlStr.includes('api.twitch.tv/helix/users')) {
      return Promise.resolve({
        ok: userOk,
        json: () => Promise.resolve({ data: [TWITCH_USER] }),
      } as Response)
    }
    return Promise.resolve({ ok: false } as Response)
  })
}

function createMockServer() {
  return {
    users: {
      getIdentity: vi.fn().mockResolvedValue(null),
      getUserByIdentity: vi.fn().mockResolvedValue(null),
      getUser: vi.fn().mockResolvedValue(null),
      createUser: vi.fn().mockImplementation((u: any) => Promise.resolve({ ...u, id: 1 as UserId })),
      updateUser: vi.fn().mockResolvedValue(undefined),
      clientIdTaken: vi.fn().mockResolvedValue(false),
      addAuthToken: vi.fn().mockResolvedValue('mock-token'),
    },
    repos: {
      userIdentity: {
        insert: vi.fn().mockResolvedValue(1),
        update: vi.fn().mockResolvedValue(undefined),
      },
    },
  }
}

describe('TwitchAuth', () => {
  let mockServer: ReturnType<typeof createMockServer>
  let fetchFn: ReturnType<typeof mockFetchFn>

  beforeEach(() => {
    mockServer = createMockServer()
    fetchFn = mockFetchFn(true, true)
    vi.clearAllMocks()
  })

  describe('handle', () => {
    it('should return ok and userId for a new user', async () => {
      const twitchAuth = new TwitchAuth(mockServer as any, TWITCH_CONFIG, fetchFn)

      const result = await twitchAuth.handle('auth-code', 'client-abc', REDIRECT_URIS)

      expect(result.ok).toBe(true)
      expect(result.userId).toBeDefined()
      expect(mockServer.users.createUser).toHaveBeenCalled()
      expect(mockServer.repos.userIdentity.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          provider_name: 'twitch',
          provider_id: TWITCH_USER.id,
          provider_email: TWITCH_USER.email,
        }),
      )
    })

    it('should return ok for an existing user found by identity', async () => {
      const existingUser = makeUserRow()
      const existingIdentity = makeIdentityRow()
      mockServer.users.getIdentity.mockResolvedValue(existingIdentity)
      mockServer.users.getUserByIdentity.mockResolvedValue(existingUser)

      const twitchAuth = new TwitchAuth(mockServer as any, TWITCH_CONFIG, fetchFn)
      const result = await twitchAuth.handle('auth-code', 'client-abc', REDIRECT_URIS)

      expect(result.ok).toBe(true)
      expect(result.userId).toBe(existingUser.id)
      expect(mockServer.users.createUser).not.toHaveBeenCalled()
    })

    it('should return ok for an existing user found by client_id', async () => {
      const existingUser = makeUserRow()
      mockServer.users.getUser.mockResolvedValue(existingUser)

      const twitchAuth = new TwitchAuth(mockServer as any, TWITCH_CONFIG, fetchFn)
      const result = await twitchAuth.handle('auth-code', 'client-abc', REDIRECT_URIS)

      expect(result.ok).toBe(true)
      expect(result.userId).toBe(existingUser.id)
      expect(mockServer.users.createUser).not.toHaveBeenCalled()
      expect(mockServer.repos.userIdentity.insert).toHaveBeenCalled()
    })

    it('should update user name and email if changed', async () => {
      const existingUser = makeUserRow({ name: 'OldName', email: '' })
      const existingIdentity = makeIdentityRow()
      mockServer.users.getIdentity.mockResolvedValue(existingIdentity)
      mockServer.users.getUserByIdentity.mockResolvedValue(existingUser)

      const twitchAuth = new TwitchAuth(mockServer as any, TWITCH_CONFIG, fetchFn)
      await twitchAuth.handle('auth-code', '', REDIRECT_URIS)

      expect(mockServer.users.updateUser).toHaveBeenCalledWith(
        expect.objectContaining({
          name: TWITCH_USER.display_name,
          email: TWITCH_USER.email,
        }),
      )
    })

    it('should not update user if name and email are unchanged', async () => {
      const existingUser = makeUserRow()
      const existingIdentity = makeIdentityRow()
      mockServer.users.getIdentity.mockResolvedValue(existingIdentity)
      mockServer.users.getUserByIdentity.mockResolvedValue(existingUser)

      const twitchAuth = new TwitchAuth(mockServer as any, TWITCH_CONFIG, fetchFn)
      await twitchAuth.handle('auth-code', '', REDIRECT_URIS)

      expect(mockServer.users.updateUser).not.toHaveBeenCalled()
    })

    it('should update identity if user_id changed', async () => {
      const existingUser = makeUserRow({ id: 2 as UserId })
      const existingIdentity = makeIdentityRow({ user_id: 1 as UserId })
      mockServer.users.getIdentity.mockResolvedValue(existingIdentity)
      mockServer.users.getUserByIdentity.mockResolvedValue(existingUser)

      const twitchAuth = new TwitchAuth(mockServer as any, TWITCH_CONFIG, fetchFn)
      await twitchAuth.handle('auth-code', '', REDIRECT_URIS)

      expect(mockServer.repos.userIdentity.update).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 2 }),
      )
    })

    it('should return not ok when token exchange fails', async () => {
      fetchFn = mockFetchFn(false, true)
      const twitchAuth = new TwitchAuth(mockServer as any, TWITCH_CONFIG, fetchFn)

      const result = await twitchAuth.handle('auth-code', '', REDIRECT_URIS)

      expect(result.ok).toBe(false)
      expect(result.userId).toBeUndefined()
    })

    it('should return not ok when user fetch fails', async () => {
      fetchFn = mockFetchFn(true, false)
      const twitchAuth = new TwitchAuth(mockServer as any, TWITCH_CONFIG, fetchFn)

      const result = await twitchAuth.handle('auth-code', '', REDIRECT_URIS)

      expect(result.ok).toBe(false)
    })

    it('should try all redirect URIs before failing', async () => {
      const uris = ['http://first/callback', 'http://second/callback']
      fetchFn = mockFetchFn(false, true)
      const twitchAuth = new TwitchAuth(mockServer as any, TWITCH_CONFIG, fetchFn)

      await twitchAuth.handle('auth-code', '', uris)

      const tokenCalls = fetchFn.mock.calls.filter(
        ([url]) => String(url).includes('id.twitch.tv/oauth2/token'),
      )
      expect(tokenCalls).toHaveLength(2)
    })

    it('should use existing client_id for new user when not taken', async () => {
      mockServer.users.clientIdTaken.mockResolvedValue(false)
      const twitchAuth = new TwitchAuth(mockServer as any, TWITCH_CONFIG, fetchFn)

      await twitchAuth.handle('auth-code', 'my-client-id', REDIRECT_URIS)

      expect(mockServer.users.createUser).toHaveBeenCalledWith(
        expect.objectContaining({ client_id: 'my-client-id' }),
      )
    })

    it('should generate new client_id for new user when original is taken', async () => {
      mockServer.users.clientIdTaken.mockResolvedValue(true)
      const twitchAuth = new TwitchAuth(mockServer as any, TWITCH_CONFIG, fetchFn)

      await twitchAuth.handle('auth-code', 'taken-id', REDIRECT_URIS)

      expect(mockServer.users.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          client_id: expect.not.stringMatching('taken-id'),
        }),
      )
    })

    it('should propagate errors from server calls', async () => {
      mockServer.users.getIdentity.mockRejectedValue(new Error('db error'))
      const twitchAuth = new TwitchAuth(mockServer as any, TWITCH_CONFIG, fetchFn)

      await expect(twitchAuth.handle('auth-code', '', REDIRECT_URIS)).rejects.toThrow('db error')
    })
  })
})
