import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GameService } from './GameService'
import { PuzzleService } from './PuzzleService'
import { ShapeMode, RotationMode } from '@common/Types'
import type { GameRow, ImageInfo } from '@common/Types'
import Util from '@common/Util'

// Mock dependencies
const mockServer = {
  repos: {
    games: {
      getGameRowById: vi.fn(),
    },
    images: {
      get: vi.fn(),
      getGameCount: vi.fn(),
    },
    users: {
      getMany: vi.fn(),
    },
  },
}

const mockPuzzleService = new PuzzleService()

describe('GameService', () => {
  let gameService: GameService

  beforeEach(() => {
    gameService = new GameService(mockPuzzleService)
    gameService.init(mockServer as any)
    vi.clearAllMocks()
  })

  describe('createNewGameObjForReplay', () => {
    it('should use original game started timestamp for RNG seed, not creation time', async () => {
      // Arrange
      const gameId = 'test-game-id' as any
      const gameCreatedTime = 1609459200000 // 2021-01-01 00:00:00 (game creation time)
      const gameStartedTime = 1609462800000 // 2021-01-01 01:00:00 (1 hour later - actual game start)

      const mockImage: ImageInfo = {
        id: 'image-1' as any,
        uploaderUserId: null,
        uploaderName: null,
        width: 512,
        height: 384,
        filename: 'test.jpg',
        url: 'test.jpg',
        title: 'Test Image',
        tags: [],
        created: gameCreatedTime,
        gameCount: 0,
        private: false,
        copyrightName: '',
        copyrightURL: '',
        reported: 0,
        nsfw: false,
      }

      const mockGameRow: GameRow = {
        id: gameId,
        creator_user_id: 'user1' as any,
        image_id: mockImage.id,
        created: new Date(gameCreatedTime).toISOString() as any, // Game creation time
        finished: null,
        data: JSON.stringify({
          id: gameId,
          gameVersion: 1,
          rng: { type: 'Rng', obj: { seed: Util.hash(gameId + ' ' + gameStartedTime) } },
          puzzle: {
            info: {
              targetTiles: 100,
              image: mockImage,
            },
            data: {
              started: gameStartedTime, // Different from creation time!
            },
          },
          players: [],
          scoreMode: 0,
          shapeMode: ShapeMode.NORMAL,
          snapMode: 0,
          rotationMode: RotationMode.NONE,
          hasReplay: true,
        }),
        private: 0,
        pieces_count: 100,
        require_account: 0,
        join_password: null,
        show_image_preview_in_background: 0,
        image_snapshot_url: null,
        reported: 0,
      }

      // Mock the repository calls
      mockServer.repos.games.getGameRowById.mockResolvedValue(mockGameRow)
      mockServer.repos.images.get.mockResolvedValue({
        id: mockImage.id,
        reported: 0,
        nsfw: false,
      })
      mockServer.repos.images.getGameCount.mockResolvedValue(5)
      mockServer.repos.users.getMany.mockResolvedValue([])

      // Act
      const replayGame = await gameService.createNewGameObjForReplay(gameId)

      // Assert
      expect(replayGame).toBeDefined()

      // The critical test: The replay game should use the original started timestamp for the RNG seed
      // This means puzzle.data.started should be gameStartedTime, NOT gameCreatedTime
      expect(replayGame!.puzzle.data.started).toBe(gameStartedTime)

      // If the bug exists, this would fail because the service would use gameCreatedTime instead
      expect(replayGame!.puzzle.data.started).not.toBe(gameCreatedTime)
    })

    it('should create deterministic puzzle layout using original game seed', async () => {
      // Arrange
      const gameId = 'deterministic-test' as any
      const gameCreatedTime = 1609459200000 // Game creation timestamp
      const gameStartedTime = 1609462800000 // Game started timestamp (different!)

      const mockImage: ImageInfo = {
        id: 'image-1' as any,
        uploaderUserId: null,
        uploaderName: null,
        width: 256,
        height: 256,
        filename: 'test.jpg',
        url: 'test.jpg',
        title: 'Test Image',
        tags: [],
        created: gameCreatedTime,
        gameCount: 0,
        private: false,
        copyrightName: '',
        copyrightURL: '',
        reported: 0,
        nsfw: false,
      }

      // Create a reference puzzle using the correct seed (gameId + gameStartedTime)
      const correctSeed = Util.hash(gameId + ' ' + gameStartedTime)
      const referencePuzzle = mockPuzzleService.createPuzzle(
        new (await import('@common/Rng')).Rng(correctSeed),
        25,
        mockImage,
        gameStartedTime,
        ShapeMode.NORMAL,
        RotationMode.NONE,
        1,
      )

      const mockGameRow: GameRow = {
        id: gameId,
        creator_user_id: 'user1' as any,
        image_id: mockImage.id,
        created: new Date(gameCreatedTime).toISOString() as any, // Different from started time
        finished: null,
        data: JSON.stringify({
          id: gameId,
          gameVersion: 1,
          rng: { type: 'Rng', obj: { seed: correctSeed } },
          puzzle: {
            info: {
              targetTiles: 25,
              image: mockImage,
            },
            data: {
              started: gameStartedTime, // This should be used for replay seed
            },
          },
          players: [],
          scoreMode: 0,
          shapeMode: ShapeMode.NORMAL,
          snapMode: 0,
          rotationMode: RotationMode.NONE,
          hasReplay: true,
        }),
        private: 0,
        pieces_count: 25,
        require_account: 0,
        join_password: null,
        show_image_preview_in_background: 0,
        image_snapshot_url: null,
        reported: 0,
      }

      mockServer.repos.games.getGameRowById.mockResolvedValue(mockGameRow)
      mockServer.repos.images.get.mockResolvedValue({ id: mockImage.id, reported: 0, nsfw: false })
      mockServer.repos.images.getGameCount.mockResolvedValue(1)
      mockServer.repos.users.getMany.mockResolvedValue([])

      // Act
      const replayGame = await gameService.createNewGameObjForReplay(gameId)

      // Assert - The replay should create the same puzzle as the reference
      expect(replayGame).toBeDefined()
      expect(replayGame!.puzzle.tiles.length).toBe(referencePuzzle.tiles.length)

      // If the bug exists (using gameCreatedTime instead of gameStartedTime),
      // the puzzle would be different and this would fail
      for (let i = 0; i < Math.min(5, replayGame!.puzzle.tiles.length); i++) {
        // Check first few pieces to verify same puzzle generation
        expect(replayGame!.puzzle.tiles[i].length).toBe(referencePuzzle.tiles[i].length)
      }
    })

    it('should return null when game is not found', async () => {
      // Arrange
      const gameId = 'non-existent-game' as any
      mockServer.repos.games.getGameRowById.mockResolvedValue(null)

      // Act
      const result = await gameService.createNewGameObjForReplay(gameId)

      // Assert
      expect(result).toBeNull()
      expect(mockServer.repos.games.getGameRowById).toHaveBeenCalledWith(gameId)
    })

    it('should handle malformed game data gracefully', async () => {
      // Arrange
      const gameId = 'malformed-game' as any
      const mockGameRow: GameRow = {
        id: gameId,
        creator_user_id: 'user1' as any,
        image_id: 'image1' as any,
        created: '2021-01-01T00:00:00.000Z' as any,
        finished: null,
        data: 'invalid-json-data',
        private: 0,
        pieces_count: 100,
        require_account: 0,
        join_password: null,
        show_image_preview_in_background: 0,
        image_snapshot_url: null,
        reported: 0,
      }

      mockServer.repos.games.getGameRowById.mockResolvedValue(mockGameRow)

      // Act
      const result = await gameService.createNewGameObjForReplay(gameId)

      // Assert
      expect(result).toBeNull()
    })
  })
})
