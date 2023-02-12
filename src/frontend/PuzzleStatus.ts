import GameCommon from './../common/GameCommon'
import { GamePlay } from './GamePlay';
import { GameReplay } from './GameReplay';

export class PuzzleStatus {
  constructor(private game: GamePlay | GameReplay) {
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
      active: GameCommon.getActivePlayers(this.game.getGameId(), ts),
      idle: GameCommon.getIdlePlayers(this.game.getGameId(), ts),
    })
  }
}
