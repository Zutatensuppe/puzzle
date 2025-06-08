import {
  DefaultScoreMode, DefaultShapeMode, DefaultSnapMode, Game, Puzzle,
  EncodedPlayer, ScoreMode, ShapeMode, SnapMode, ImageInfo, Timestamp, GameSettings, GameEvent, RegisteredMap, ImageSnapshots, HandleGameEventResult,
  DefaultRotationMode,
  RotationMode,
  GameId,
  UserId,
  ClientId,
  GameInfo,
  ServerErrorDetails,
  ClientInitEvent,
  GameRow,
  UserRow,
} from '../../common/src/Types'
import Util, { logger } from '../../common/src/Util'
import { Rng, RngSerialized } from '../../common/src/Rng'
import GameLog from './GameLog'
import { Rect } from '../../common/src/Geometry'
import { PuzzleService } from './PuzzleService'
import GameCommon, { NEWGAME_MAX_PIECES, NEWGAME_MIN_PIECES } from '../../common/src/GameCommon'
import { GAME_VERSION, LOG_TYPE } from '../../common/src/Protocol'
import Crypto from './Crypto'
import { Server } from './Server'

const log = logger('GameService.js')

interface GameStoreData {
  id: GameId
  gameVersion: number
  rng: {
    type?: string
    obj: RngSerialized
  }
  puzzle: Puzzle
  state?: {
    imageSnapshots: ImageSnapshots
  }
  players: EncodedPlayer[]
  scoreMode: ScoreMode
  shapeMode: ShapeMode
  snapMode: SnapMode
  rotationMode?: RotationMode
  hasReplay: boolean
  crop?: Rect
  banned?: Record<ClientId, boolean>
}

export class GameService {
  private dirtyGames: Record<GameId, boolean> = {}
  private server!: Server

  constructor(
    private readonly puzzleService: PuzzleService,
  ) {
    // pass
  }

  public init (server: Server) {
    this.server = server
  }

  private setDirty(gameId: GameId): void {
    this.dirtyGames[gameId] = true
  }

  private setClean(gameId: GameId): void {
    if (gameId in this.dirtyGames) {
      delete this.dirtyGames[gameId]
    }
  }

  private async gameRowToGameObject(gameRow: GameRow): Promise<Game | null> {
    let game: GameStoreData
    try {
      game = JSON.parse(gameRow.data)
    } catch {
      return null
    }
    if (typeof game.puzzle.data.started === 'undefined') {
      game.puzzle.data.started = (new Date(gameRow.created)).getTime()
    }
    if (typeof game.puzzle.data.finished === 'undefined') {
      game.puzzle.data.finished = gameRow.finished ? gameRow.finished.getTime() : 0
    }
    if (!Array.isArray(game.players)) {
      game.players = Object.values(game.players)
    }

    const imageId = game.puzzle.info.image.id
    const image = await this.server.repos.images.get({ id: imageId })
    game.puzzle.info.image.gameCount = await this.server.repos.images.getGameCount(imageId)
    game.puzzle.info.image.reported = image?.reported || 0
    game.puzzle.info.image.nsfw = !!(image?.nsfw)

    const gameVersion = game.gameVersion || 1 // old games didnt have this stored
    return {
      id: game.id,
      gameVersion,
      creatorUserId: gameRow.creator_user_id,
      rng: {
        type: game.rng ? game.rng.type : '_fake_',
        obj: game.rng ? Rng.unserialize(game.rng.obj) : new Rng(0),
      },
      puzzle: game.puzzle,
      players: game.players,
      scoreMode: DefaultScoreMode(game.scoreMode),
      shapeMode: DefaultShapeMode(game.shapeMode),
      snapMode: DefaultSnapMode(game.snapMode),
      rotationMode: DefaultRotationMode(game.rotationMode),
      hasReplay: await GameLog.hasReplay(game.id, gameVersion),
      private: !!gameRow.private,
      requireAccount: !!gameRow.require_account,
      joinPassword: gameRow.join_password,
      registeredMap: await this.generateRegisteredMap(game.players),
      banned: game.banned || {},
      crop: game.crop,
      showImagePreviewInBackground: !!gameRow.show_image_preview_in_background,
    }
  }

  public async generateRegisteredMap(players: EncodedPlayer[]): Promise<RegisteredMap> {
    const registeredMap: RegisteredMap = {}
    const users = await this.server.repos.users.getMany({
      client_id: { '$in': players.map(player => player[0]) },
    })
    for (const user of users) {
      if (user.email) {
        registeredMap[user.client_id] = true
      }
    }
    return registeredMap
  }

  public async delete(gameId: GameId): Promise<void> {
    await this.server.repos.games.delete(gameId)
    GameCommon.unsetGame(gameId)
    GameLog.unsetGame(gameId)
    this.server.gameSockets.disconnectAll(gameId)
    this.server.gameSockets.removeSocketInfo(gameId)
  }

  public async deleteRunningGameIfCreatedByUser(gameId: GameId, userId: UserId): Promise<void> {
    await this.ensureLoaded(gameId)
    if (GameCommon.isFinished(gameId)) {
      throw new Error('game is already finished')
    }
    if (GameCommon.getCreatorUserId(gameId) !== userId) {
      throw new Error('not the creator')
    }
    await this.delete(gameId)
  }

  public async ensureLoaded(gameId: GameId): Promise<boolean> {
    if (GameCommon.loaded(gameId)) {
      return true
    }

    if (GameCommon.isGameLoading(gameId)) {
      return new Promise<boolean>((resolve) => {
        GameCommon.onGameLoadingStateChange(gameId, resolve)
      })
    }

    let gameObject: Game | null = null
    GameCommon.setGameLoading(gameId, true)
    try {
      gameObject = await this.loadGame(gameId)
      await GameLog.loadFromDisk(gameId)
    } catch {
      GameCommon.setGameLoading(gameId, false)
      return false
    }

    if (gameObject) {
      GameCommon.setGame(gameObject.id, gameObject)
      GameCommon.setGameLoading(gameId, false)
      return true
    }

    GameCommon.setGameLoading(gameId, false)
    return false
  }

  public async createNewGameObjForReplay(gameId: GameId): Promise<Game | null> {
    log.info(`createNewGameObj: ${gameId}`)
    const gameRow = await this.server.repos.games.getGameRowById(gameId)
    if (!gameRow) {
      log.info(`createNewGameObj, game not found: ${gameId}`)
      return null
    }
    const gameObject = await this.gameRowToGameObject(gameRow)
    if (!gameObject) {
      log.info(`createNewGameObj, game object not created: ${gameId}`)
      return null
    }

    const gameObj = this.createGameObject(
      gameObject.id,
      gameObject.gameVersion,
      gameObject.puzzle.info.targetTiles,
      gameObject.puzzle.info.image,
      (new Date(gameRow.created)).getTime(),
      gameObject.scoreMode,
      gameObject.shapeMode,
      gameObject.snapMode,
      gameObject.rotationMode,
      gameObject.creatorUserId,
      true, // hasReplay
      gameObject.private,
      gameObject.requireAccount,
      gameObject.joinPassword,
      gameObject.crop,
      gameObject.showImagePreviewInBackground,
    )
    gameObj.puzzle.info.image.gameCount = await this.server.repos.images.getGameCount(gameObj.puzzle.info.image.id)
    gameObj.registeredMap = await this.generateRegisteredMap(gameObj.players)
    return gameObj
  }

  private async loadGame(gameId: GameId): Promise<Game | null> {
    log.info(`[INFO] loading game: ${gameId}`)
    const gameRow = await this.server.repos.games.getGameRowById(gameId)
    if (!gameRow) {
      log.info(`[INFO] game not found: ${gameId}`)
      return null
    }
    const gameObjects = await this.gameRowsToGames([gameRow])
    return gameObjects.length > 0 ? gameObjects[0] : null
  }

  private async gameRowsToGames(gameRows: GameRow[]): Promise<Game[]> {
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

  public async getPublicRunningGames(offset: number, limit: number, userId: UserId): Promise<GameRow[]> {
    return await this.server.repos.games.getPublicRunningGames(offset, limit, userId)
  }

  public async getPublicFinishedGames(offset: number, limit: number, userId: UserId): Promise<GameRow[]> {
    return await this.server.repos.games.getPublicFinishedGames(offset, limit, userId)
  }

  public async countPublicRunningGames(userId: UserId): Promise<number> {
    return await this.server.repos.games.countPublicRunningGames(userId)
  }

  public async countPublicFinishedGames(userId: UserId): Promise<number> {
    return await this.server.repos.games.countPublicFinishedGames(userId)
  }

  private async exists(gameId: GameId): Promise<boolean> {
    return await this.server.repos.games.exists(gameId)
  }

  public dirtyGameIds(): GameId[] {
    return Object.keys(this.dirtyGames) as GameId[]
  }

  public async persistGame(game: Game): Promise<void> {
    this.setClean(game.id)
    await this.server.repos.games.upsert({
      id: game.id,
      creator_user_id: game.creatorUserId,
      image_id: game.puzzle.info.image.id,
      created: JSON.stringify(new Date(game.puzzle.data.started)),
      finished: game.puzzle.data.finished ? new Date(game.puzzle.data.finished) : null,
      data: JSON.stringify(await this.gameToStoreData(game)),
      private: game.private ? 1 : 0,
      pieces_count: game.puzzle.tiles.length,
      require_account: game.requireAccount ? 1 : 0,
      join_password: game.joinPassword,
      show_image_preview_in_background: game.showImagePreviewInBackground ? 1 : 0,
    })
    await this.server.repos.games.updatePlayerRelations(game.id, game.players)

    await GameLog.flushToDisk(game.id)

    log.info(`[INFO] persisted game ${game.id}`)
  }

  async gameToGameInfo (gameRow: GameRow, ts: number): Promise<GameInfo> {
    const game = await this.gameRowToGameObject(gameRow)
    if (!game) {
      throw new Error('invalid game row')
    }
    const finished = GameCommon.Game_getFinishTs(game)
    return {
      id: game.id,
      creatorUserId: game.creatorUserId,
      hasReplay: game.hasReplay,
      isPrivate: GameCommon.Game_isPrivate(game),
      started: GameCommon.Game_getStartTs(game),
      finished,
      piecesFinished: GameCommon.Game_getFinishedPiecesCount(game),
      piecesTotal: GameCommon.Game_getPieceCount(game),
      players: finished
        ? GameCommon.Game_getPlayersWithScore(game).length
        : GameCommon.Game_getActivePlayers(game, ts).length,
      image: GameCommon.Game_getImage(game),
      imageSnapshots: gameRow.image_snapshot_url
        ? { current: { url: gameRow.image_snapshot_url } }
        : { current: null },
      snapMode: GameCommon.Game_getSnapMode(game),
      scoreMode: GameCommon.Game_getScoreMode(game),
      shapeMode: GameCommon.Game_getShapeMode(game),
      rotationMode: GameCommon.Game_getRotationMode(game),
    }
  }

  private async gameToStoreData(game: Game): Promise<GameStoreData> {
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
      rotationMode: game.rotationMode,
      // cannot use value from the game object, because it might be outdated
      hasReplay: await GameLog.hasReplay(game.id, game.gameVersion),
      crop: game.crop,
    }
  }

  private createGameObject(
    gameId: GameId,
    gameVersion: number,
    targetPieceCount: number,
    image: ImageInfo,
    ts: Timestamp,
    scoreMode: ScoreMode,
    shapeMode: ShapeMode,
    snapMode: SnapMode,
    rotationMode: RotationMode,
    creatorUserId: UserId | null,
    hasReplay: boolean,
    isPrivate: boolean,
    requireAccount: boolean,
    joinPassword: string | null,
    crop: Rect | undefined,
    showImagePreviewInBackground: boolean,
  ): Game {
    const seed = Util.hash(gameId + ' ' + ts)
    const rng = new Rng(seed)
    return {
      id: gameId,
      gameVersion,
      creatorUserId,
      rng: { type: 'Rng', obj: rng },
      puzzle: this.puzzleService.createPuzzle(rng, targetPieceCount, image, ts, shapeMode, rotationMode, gameVersion),
      players: [],
      scoreMode,
      shapeMode,
      snapMode,
      rotationMode,
      hasReplay,
      private: isPrivate,
      crop,
      requireAccount,
      joinPassword,
      registeredMap: {},
      banned: {},
      showImagePreviewInBackground,
    }
  }

  public async createNewGame(
    gameSettings: GameSettings,
    ts: Timestamp,
    creatorUserId: UserId,
  ): Promise<GameId> {
    if (gameSettings.tiles < NEWGAME_MIN_PIECES || gameSettings.tiles > NEWGAME_MAX_PIECES) {
      throw new Error(`Target pieces count must be between ${NEWGAME_MIN_PIECES} and ${NEWGAME_MAX_PIECES}`)
    }
    let gameId: GameId
    do {
      gameId = Util.uniqId() as GameId
    } while (await this.exists(gameId))

    const gameObject = this.createGameObject(
      gameId,
      GAME_VERSION,
      gameSettings.tiles,
      gameSettings.image,
      ts,
      DefaultScoreMode(gameSettings.scoreMode),
      DefaultShapeMode(gameSettings.shapeMode),
      DefaultSnapMode(gameSettings.snapMode),
      DefaultRotationMode(gameSettings.rotationMode),
      creatorUserId,
      true, // hasReplay
      gameSettings.private,
      gameSettings.requireAccount,
      gameSettings.joinPassword ? Crypto.encrypt(gameSettings.joinPassword) : null,
      gameSettings.crop,
      gameSettings.showImagePreviewInBackground,
    )

    GameLog.create(gameId, ts)
    GameLog.log(
      gameObject.id,
      [
        LOG_TYPE.HEADER,
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
        gameSettings.requireAccount,
        gameSettings.joinPassword,
      ],
    )

    GameCommon.setGame(gameObject.id, gameObject)
    await this.persistGame(gameObject)

    return gameObject.id
  }

  public addPlayer(gameId: GameId, clientId: ClientId, ts: Timestamp): void {
    if (GameLog.shouldLog(gameId, GameCommon.getFinishTs(gameId), ts)) {
      const idx = GameCommon.getPlayerIndexById(gameId, clientId)
      if (idx === -1) {
        GameLog.log(gameId, [LOG_TYPE.ADD_PLAYER, clientId, ts])
      } else {
        GameLog.log(gameId, [LOG_TYPE.UPDATE_PLAYER, idx, ts])
      }
    }

    GameCommon.addPlayer(gameId, clientId, ts)
    this.setDirty(gameId)
  }

  public async handleGameEvent(
    gameId: GameId,
    clientId: ClientId,
    gameEvent: GameEvent,
    ts: Timestamp,
  ): Promise<HandleGameEventResult> {
    if (GameLog.shouldLog(gameId, GameCommon.getFinishTs(gameId), ts)) {
      const idx = GameCommon.getPlayerIndexById(gameId, clientId)
      GameLog.log(gameId, [LOG_TYPE.GAME_EVENT, idx, gameEvent, ts])
    }
    const wasFinished = GameCommon.getFinishTs(gameId)
    const ret = GameCommon.handleGameEvent(gameId, clientId, gameEvent, ts)
    const isFinished = GameCommon.getFinishTs(gameId)
    this.setDirty(gameId)
    if (!wasFinished && isFinished) {
      const game = GameCommon.get(gameId)
      if (game) {
        // persist game immediately when it was just finished
        // and also update the leaderboard afterwards
        await this.persistGame(game)

        // no need to wait for leaderboard update
        void this.server.repos.leaderboard.updateLeaderboards()
      }
    }
    return ret
  }

  public async checkAuth(
    gameInitEvent: ClientInitEvent,
    gameId: GameId,
    clientId: ClientId,
    user: UserRow | null,
  ): Promise<ServerErrorDetails> {
    const serverErrorDetails: ServerErrorDetails = {
    }
    // if user is the creator of the game, they can join anyway
    if (user?.id === GameCommon.getCreatorUserId(gameId)) {
      return serverErrorDetails
    }
    // if user is an admin, they can join anyway
    if (user?.id && await this.server.repos.users.isInGroup(user.id, 'admin')) {
      return serverErrorDetails
    }

    if (GameCommon.isPlayerBanned(gameId, clientId)) {
      serverErrorDetails.banned = true
    }

    const msgData = gameInitEvent[1]
    // check join requirements
    if (GameCommon.requireAccount(gameId)) {
      // check if user is logged in, otherwise reject connection
      if (user?.email) {
        // this is a registered user, all good
      } else {
        // user is not logged in, send a message for the client to handle
        serverErrorDetails.requireAccount = true
      }
    }

    // msg[1] is (optional) init data, also contains password
    if (GameCommon.joinPassword(gameId)) {
      if (!msgData?.password) {
        serverErrorDetails.requirePassword = true
      } else if (Crypto.encrypt(msgData.password) !== GameCommon.joinPassword(gameId)) {
        serverErrorDetails.wrongPassword = true
      }
    }
    return serverErrorDetails
  }
}
