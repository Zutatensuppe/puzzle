import {
  DefaultScoreMode, DefaultShapeMode, DefaultSnapMode, Game, Puzzle,
  EncodedPlayer, ScoreMode, ShapeMode, SnapMode, ImageInfo, Timestamp, GameSettings, Input, Change,
} from '../common/Types'
import Util, { logger } from '../common/Util'
import { Rng, RngSerialized } from '../common/Rng'
import GameLog from './GameLog'
import { Rect } from '../common/Geometry'
import { GameRow, GamesRepo } from './repo/GamesRepo'
import { PuzzleService } from './PuzzleService'
import GameCommon, { NEWGAME_MAX_PIECES, NEWGAME_MIN_PIECES } from '../common/GameCommon'
import Protocol from '../common/Protocol'
import { LeaderboardRepo } from './repo/LeaderboardRepo'
import { ImagesRepo } from './repo/ImagesRepo'

const log = logger('GameService.js')

interface GameStoreData {
  id: string
  gameVersion: number
  rng: {
    type?: string
    obj: RngSerialized
  }
  puzzle: Puzzle
  players: EncodedPlayer[]
  scoreMode: ScoreMode
  shapeMode: ShapeMode
  snapMode: SnapMode
  hasReplay: boolean
  crop?: Rect
}

export class GameService {
  private dirtyGames: Record<string, boolean> = {}

  constructor(
    private readonly repo: GamesRepo,
    private readonly imagesRepo: ImagesRepo,
    private readonly puzzleService: PuzzleService,
    private readonly leaderboardRepo: LeaderboardRepo,
  ) {
    // pass
  }

  setDirty(gameId: string): void {
    this.dirtyGames[gameId] = true
  }

  setClean(gameId: string): void {
    if (gameId in this.dirtyGames) {
      delete this.dirtyGames[gameId]
    }
  }

  async gameRowToGameObject(gameRow: GameRow): Promise<Game | null> {
    let game: GameStoreData
    try {
      game = JSON.parse(gameRow.data)
    } catch {
      return null
    }
    if (typeof game.puzzle.data.started === 'undefined') {
      game.puzzle.data.started = gameRow.created.getTime()
    }
    if (typeof game.puzzle.data.finished === 'undefined') {
      game.puzzle.data.finished = gameRow.finished ? gameRow.finished.getTime() : 0
    }
    if (!Array.isArray(game.players)) {
      game.players = Object.values(game.players)
    }

    const gameObject: Game = this.storeDataToGame(
      game,
      gameRow.creator_user_id,
      !!gameRow.private,
    )
    gameObject.hasReplay = GameLog.hasReplay(gameObject)
    gameObject.crop = game.crop

    const gameCount = await this.imagesRepo.getGameCount(gameObject.puzzle.info.image.id)
    gameObject.puzzle.info.image.gameCount = gameCount
    return gameObject
  }

  async loadGame(gameId: string): Promise<Game | null> {
    log.info(`[INFO] loading game: ${gameId}`)
    const gameRow = await this.repo.getGameRowById(gameId)
    if (!gameRow) {
      log.info(`[INFO] game not found: ${gameId}`)
      return null
    }
    const gameObjects = await this.gameRowsToGames([gameRow])
    return gameObjects.length > 0 ? gameObjects[0] : null
  }

  async gameRowsToGames (gameRows: GameRow[]): Promise<Game[]> {
    const games: Game[] = []
    for (const gameRow of gameRows) {
      const gameObject = await this.gameRowToGameObject(gameRow)
      if (!gameObject) {
        log.error(`[ERR] unable to turn game row into game object: ${gameRow.id}`)
        continue
      }
      games.push(gameObject)
    }
    return games
  }

  async getPublicRunningGames(offset: number, limit: number, userId: number): Promise<Game[]> {
    const rows = await this.repo.getPublicRunningGames(offset, limit, userId)
    return await this.gameRowsToGames(rows)
  }

  async getPublicFinishedGames(offset: number, limit: number, userId: number): Promise<Game[]> {
    const rows = await this.repo.getPublicFinishedGames(offset, limit, userId)
    return await this.gameRowsToGames(rows)
  }

  async countPublicRunningGames(userId: number): Promise<number> {
    return await this.repo.countPublicRunningGames(userId)
  }

  async countPublicFinishedGames(userId: number): Promise<number> {
    return await this.repo.countPublicFinishedGames(userId)
  }

  async exists(gameId: string): Promise<boolean> {
    return await this.repo.exists(gameId)
  }

  dirtyGameIds(): string[] {
    return Object.keys(this.dirtyGames)
  }

  async persistGame(game: Game): Promise<void> {
    this.setClean(game.id)
    await this.repo.upsert({
      id: game.id,
      creator_user_id: game.creatorUserId,
      image_id: game.puzzle.info.image.id,
      created: new Date(game.puzzle.data.started),
      finished: game.puzzle.data.finished ? new Date(game.puzzle.data.finished) : null,
      data: JSON.stringify(this.gameToStoreData(game)),
      private: game.private ? 1 : 0,
      pieces_count: game.puzzle.tiles.length,
    }, {
      id: game.id,
    })
    await this.repo.updatePlayerRelations(game.id, game.players)

    game.players
    log.info(`[INFO] persisted game ${game.id}`)
  }

  storeDataToGame(
    storeData: GameStoreData,
    creatorUserId: number|null,
    isPrivate: boolean,
  ): Game {
    return {
      id: storeData.id,
      gameVersion: storeData.gameVersion || 1, // old games didnt have this stored
      creatorUserId,
      rng: {
        type: storeData.rng ? storeData.rng.type : '_fake_',
        obj: storeData.rng ? Rng.unserialize(storeData.rng.obj) : new Rng(0),
      },
      puzzle: storeData.puzzle,
      players: storeData.players,
      scoreMode: DefaultScoreMode(storeData.scoreMode),
      shapeMode: DefaultShapeMode(storeData.shapeMode),
      snapMode: DefaultSnapMode(storeData.snapMode),
      hasReplay: !!storeData.hasReplay,
      private: isPrivate,
    }
  }

  gameToStoreData(game: Game): GameStoreData {
    return {
      id: game.id,
      gameVersion: game.gameVersion,
      rng: {
        type: game.rng.type,
        obj: Rng.serialize(game.rng.obj),
      },
      puzzle: game.puzzle,
      players: game.players,
      scoreMode: game.scoreMode,
      shapeMode: game.shapeMode,
      snapMode: game.snapMode,
      hasReplay: game.hasReplay,
      crop: game.crop,
    }
  }

  async createGameObject(
    gameId: string,
    gameVersion: number,
    targetPieceCount: number,
    image: ImageInfo,
    ts: Timestamp,
    scoreMode: ScoreMode,
    shapeMode: ShapeMode,
    snapMode: SnapMode,
    creatorUserId: number|null,
    hasReplay: boolean,
    isPrivate: boolean,
    crop: Rect,
  ): Promise<Game> {
    const seed = Util.hash(gameId + ' ' + ts)
    const rng = new Rng(seed)
    return {
      id: gameId,
      gameVersion: gameVersion,
      creatorUserId,
      rng: { type: 'Rng', obj: rng },
      puzzle: await this.puzzleService.createPuzzle(rng, targetPieceCount, image, ts, shapeMode, gameVersion),
      players: [],
      scoreMode,
      shapeMode,
      snapMode,
      hasReplay,
      private: isPrivate,
      crop,
    }
  }

  async createNewGame(
    gameSettings: GameSettings,
    ts: Timestamp,
    creatorUserId: number,
  ): Promise<string> {
    if (gameSettings.tiles < NEWGAME_MIN_PIECES || gameSettings.tiles > NEWGAME_MAX_PIECES) {
      throw new Error(`Target pieces count must be between ${NEWGAME_MIN_PIECES} and ${NEWGAME_MAX_PIECES}`)
    }
    let gameId
    do {
      gameId = Util.uniqId()
    } while (await this.exists(gameId))

    const gameObject = await this.createGameObject(
      gameId,
      Protocol.GAME_VERSION,
      gameSettings.tiles,
      gameSettings.image,
      ts,
      gameSettings.scoreMode,
      gameSettings.shapeMode,
      gameSettings.snapMode,
      creatorUserId,
      true, // hasReplay
      gameSettings.private,
      gameSettings.crop,
    )

    GameLog.create(gameId, ts)
    GameLog.log(
      gameObject.id,
      Protocol.LOG_HEADER,
      gameObject.gameVersion,
      gameSettings.tiles,
      gameSettings.image,
      ts,
      gameObject.scoreMode,
      gameObject.shapeMode,
      gameObject.snapMode,
      gameObject.creatorUserId,
      gameObject.private ? 1 : 0,
      gameSettings.crop,
    )

    GameCommon.setGame(gameObject.id, gameObject)
    await this.persistGame(gameObject)

    return gameObject.id
  }

  addPlayer(gameId: string, playerId: string, ts: Timestamp): void {
    if (GameLog.shouldLog(GameCommon.getFinishTs(gameId), ts)) {
      const idx = GameCommon.getPlayerIndexById(gameId, playerId)
      if (idx === -1) {
        GameLog.log(gameId, Protocol.LOG_ADD_PLAYER, playerId, ts)
      } else {
        GameLog.log(gameId, Protocol.LOG_UPDATE_PLAYER, idx, ts)
      }
    }

    GameCommon.addPlayer(gameId, playerId, ts)
    this.setDirty(gameId)
  }

  async handleInput(
    gameId: string,
    playerId: string,
    input: Input,
    ts: Timestamp,
  ): Promise<Change[]> {
    if (GameLog.shouldLog(GameCommon.getFinishTs(gameId), ts)) {
      const idx = GameCommon.getPlayerIndexById(gameId, playerId)
      GameLog.log(gameId, Protocol.LOG_HANDLE_INPUT, idx, input, ts)
    }
    const wasFinished = GameCommon.getFinishTs(gameId)
    const ret = GameCommon.handleInput(gameId, playerId, input, ts)
    const isFinished = GameCommon.getFinishTs(gameId)
    this.setDirty(gameId)
    if (!wasFinished && isFinished) {
      const game = GameCommon.get(gameId)
      if (game) {
        // persist game immediately when it was just finished
        // and also update the leaderboard afterwards
        await this.persistGame(game)
        await this.leaderboardRepo.updateLeaderboards()
      }
    }
    return ret
  }
}
