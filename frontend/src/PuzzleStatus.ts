import GameCommon from '@common/GameCommon'
import type { GameInterface } from './Game'
import type { PuzzleStatusInterface } from '@common/Types'
import { playerToBasicPlayerInfo } from '@common/Util'

export class PuzzleStatus implements PuzzleStatusInterface {
  constructor(private game: GameInterface) {
    // pass
  }

  update(ts: number) {
    const startTs = GameCommon.getStartTs(this.game.getGameId())
    const finishTs = GameCommon.getFinishTs(this.game.getGameId())

    this.game.changeStatus({
      finished: !!(finishTs),
      duration: (finishTs || ts) - startTs,
      piecesDone: GameCommon.getFinishedPiecesCount(this.game.getGameId()),
      piecesTotal: GameCommon.getPieceCount(this.game.getGameId()),
    })

    this.game.changePlayers({
      active: GameCommon.getActivePlayers(this.game.getGameId(), ts).map(playerToBasicPlayerInfo),
      idle: GameCommon.getIdlePlayers(this.game.getGameId(), ts).map(playerToBasicPlayerInfo),
      banned: GameCommon.getBannedPlayers(this.game.getGameId()).map(playerToBasicPlayerInfo),
    }, GameCommon.getRegisteredMap(this.game.getGameId()))
  }
}
