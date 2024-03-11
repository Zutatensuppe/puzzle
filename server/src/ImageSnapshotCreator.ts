import { ImageSnapshotMode, PLAYER_SETTINGS_DEFAULTS, Piece, Player, PlayerSettingsData } from '../../common/src/Types'
import { createCanvas } from 'canvas'
import fs from 'fs'
import { Graphics } from './Graphics'
import GameCommon from '../../common/src/GameCommon'
import { Renderer } from '../../common/src/Renderer'
import { Camera } from '../../common/src/Camera'
import { logger } from '../../common/src/Util'
import config from './Config'

const log = logger('video.ts')

export const updateCurrentImageSnapshot = async (gameId: string, snapshotMode: ImageSnapshotMode) => {
  if (snapshotMode === 'none') {
    return
  }

  const boardDim = GameCommon.getBoardDim(gameId)
  const tableDim = GameCommon.getTableDim(gameId)
  const canvas = createCanvas(boardDim.w, boardDim.h) as unknown as HTMLCanvasElement
  const graphics = new Graphics(config.http.publicBaseUrl)

  const playerSettings: PlayerSettingsData = {
    background: PLAYER_SETTINGS_DEFAULTS.COLOR_BACKGROUND,
    showTable: PLAYER_SETTINGS_DEFAULTS.SHOW_TABLE,
    tableTexture: PLAYER_SETTINGS_DEFAULTS.TABLE_TEXTURE,
    useCustomTableTexture: PLAYER_SETTINGS_DEFAULTS.USE_CUSTOM_TABLE_TEXTURE,
    customTableTexture: PLAYER_SETTINGS_DEFAULTS.CUSTOM_TABLE_TEXTURE,
    customTableTextureScale: PLAYER_SETTINGS_DEFAULTS.CUSTOM_TABLE_TEXTURE_SCALE,
    color: PLAYER_SETTINGS_DEFAULTS.PLAYER_COLOR,
    name: PLAYER_SETTINGS_DEFAULTS.PLAYER_NAME,
    soundsEnabled: PLAYER_SETTINGS_DEFAULTS.SOUND_ENABLED,
    otherPlayerClickSoundEnabled: PLAYER_SETTINGS_DEFAULTS.OTHER_PLAYER_CLICK_SOUND_ENABLED,
    soundsVolume: PLAYER_SETTINGS_DEFAULTS.SOUND_VOLUME,
    showPlayerNames: PLAYER_SETTINGS_DEFAULTS.SHOW_PLAYER_NAMES,
  }

  const viewport = new Camera()

  log.info('initializing renderer')
  const drawPieces = snapshotMode === 'simple' ? false : true
  const renderer = new Renderer(gameId, canvas, viewport, null, null, true, true, drawPieces)
  await renderer.init(graphics)
  log.info('renderer inited')

  viewport.calculateZoomCapping(boardDim, tableDim)
  viewport.centerFit(
    { w: canvas.width, h: canvas.height },
    tableDim,
    boardDim,
    0,
  )

  const currTs = new Date().getTime()
  const dir = `${config.dir.UPLOAD_DIR}/image_snapshots`
  const filename = `${gameId}_${currTs}.jpeg`
  // create image
  await renderer.render(
    currTs,
    playerSettings,
    null,
    { update: (_ts: number) => { return } },
    (_piece: Piece) => true,
    (_player: Player) => true,
    false,
  )
  const data = canvas.toDataURL('image/jpeg', 75)

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(
    `${dir}/${filename}`,
    new Buffer(data.split(',')[1], 'base64'),
  )

  GameCommon.setImageSnapshots(gameId, { current: {
    url: `/uploads/image_snapshots/${filename}`,
  }})
}
