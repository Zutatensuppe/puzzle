import { EncodedPiece, EncodedPlayer, GameId, PlayerSettingsData, createDefaultPlayerSettingsData } from '../../common/src/Types'
import GameCommon from '../../common/src/GameCommon'
import { Renderer } from '../../common/src/Renderer'
import { logger } from '../../common/src/Util'
import { RendererWebgl } from './RendererWebgl'

const log = logger('ImageSnapshotCreator.ts')

export const createImageSnapshot = (
  gameId: GameId,
  renderer: Renderer | RendererWebgl,
): string => {
  const boardDim = GameCommon.getBoardDim(gameId)
  const tableDim = GameCommon.getTableDim(gameId)

  const playerSettings: PlayerSettingsData = createDefaultPlayerSettingsData()
  playerSettings.showTable = false

  return renderer.renderToImageString(
    boardDim,
    tableDim,
    new Date().getTime(),
    playerSettings,
    (_piece: EncodedPiece) => true,
    (_player: EncodedPlayer) => false,
    true,
  )
}
