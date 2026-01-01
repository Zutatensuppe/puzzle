import { createDefaultPlayerSettingsData } from '@common/Types'
import type { EncodedPiece, EncodedPlayer, GameId, PlayerSettingsData } from '@common/Types'
import GameCommon from '@common/GameCommon'
import { logger } from '@common/Util'
import type { RendererWebgl } from './RendererWebgl'
import type { Renderer } from './Renderer'

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
