import GameCommon from '@common/GameCommon'
import type { Server } from '../Server'
import { EncodedPieceIdx } from '@common/Types'
import type { FixPiecesResult, GameId } from '@common/Types'
import { logger } from '@common/Util'

const log = logger()

export class FixPieces {
  constructor(
    private readonly server: Server,
  ) {}

  public async run(gameId: GameId): Promise<FixPiecesResult> {
      const loaded = await this.server.gameService.ensureLoaded(gameId)
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
        const encodedGame = await this.server.getEncodedGameForSync(gameId)
        this.server.syncGameToClients(gameId, encodedGame)
      }
      return {
        ok: true,
        changed,
      }
  }
}
