import GameCommon from '../GameCommon'
import { ServerInterface } from '../Server'
import { EncodedPieceIdx, FixPiecesResult, Game, GameId } from '../../../common/src/Types'
import Util, { logger } from '../Util'

const log = logger()

export class FixPieces {
  constructor(
    private readonly server: ServerInterface,
  ) {

  }

  public async run(gameId: GameId): Promise<FixPiecesResult> {
      const loaded = await this.server.getGameService().ensureLoaded(gameId)
      if (!loaded) {
        return {
          ok: false,
          error: `[game ${gameId} does not exist... ]`,
        }
      }

      let changed = 0
      const pieces = GameCommon.getEncodedPiecesSortedByZIndex(gameId)
      for (const piece of pieces) {
        if (piece[EncodedPieceIdx.OWNER] === -1) {
          const p = GameCommon.getFinalPiecePos(gameId, piece[EncodedPieceIdx.IDX])
          if (p.x === piece[EncodedPieceIdx.POS_X] && p.y === piece[EncodedPieceIdx.POS_Y]) {
            // log.log('all good', tile.pos)
          } else {
            const piecePos = { x: piece[EncodedPieceIdx.POS_X], y: piece[EncodedPieceIdx.POS_Y] }
            log.log('bad piece pos', piecePos, 'should be: ', p)
            piece[EncodedPieceIdx.POS_X] = p.x
            piece[EncodedPieceIdx.POS_Y] = p.y
            GameCommon.setPiece(gameId, piece[EncodedPieceIdx.IDX], piece)
            changed++
          }
        } else if (piece[EncodedPieceIdx.OWNER] !== 0) {
          log.log('unowning piece', piece[EncodedPieceIdx.IDX])
          piece[EncodedPieceIdx.OWNER] = 0
          GameCommon.setPiece(gameId, piece[EncodedPieceIdx.IDX], piece)
          changed++
        }
      }
      if (changed) {
        await this.server.persistGame(gameId)
        const game: Game | null = GameCommon.get(gameId)
        if (!game) {
          return {
            ok: false,
            error: `[game ${gameId} does not exist (anymore)... ]`,
          }
        }
        game.registeredMap = await this.server.getGameService().generateRegisteredMap(game)

        const encodedGame = Util.encodeGame(game)
        this.server.syncGameToClients(gameId, encodedGame)
      }
      return {
        ok: true,
        changed,
      }
  }
}
