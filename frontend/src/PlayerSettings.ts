import { MODE_REPLAY } from './GameMode'
import storage from './storage'
import GameCommon from '../../common/src/GameCommon'
import type { GameInterface } from './Game'
import { PLAYER_SETTINGS, PLAYER_SETTINGS_DEFAULTS, RendererType } from '../../common/src/Types'
import type { PlayerSettingsData } from '../../common/src/Types'

export class PlayerSettings {

  private settings!: PlayerSettingsData

  constructor(private game: GameInterface) {
    // pass
  }

  init() {
    this.settings = {} as PlayerSettingsData
    this.settings.soundsVolume = storage.getInt(PLAYER_SETTINGS.SOUND_VOLUME, PLAYER_SETTINGS_DEFAULTS.SOUND_VOLUME)
    this.settings.otherPlayerClickSoundEnabled = storage.getBool(PLAYER_SETTINGS.OTHER_PLAYER_CLICK_SOUND_ENABLED, PLAYER_SETTINGS_DEFAULTS.OTHER_PLAYER_CLICK_SOUND_ENABLED)
    this.settings.mouseRotate = storage.getBool(PLAYER_SETTINGS.MOUSE_ROTATE, PLAYER_SETTINGS_DEFAULTS.MOUSE_ROTATE)
    this.settings.rotateSoundEnabled = storage.getBool(PLAYER_SETTINGS.ROTATE_SOUND_ENABLED, PLAYER_SETTINGS_DEFAULTS.ROTATE_SOUND_ENABLED)
    this.settings.soundsEnabled = storage.getBool(PLAYER_SETTINGS.SOUND_ENABLED, PLAYER_SETTINGS_DEFAULTS.SOUND_ENABLED)
    this.settings.showPlayerNames = storage.getBool(PLAYER_SETTINGS.SHOW_PLAYER_NAMES, PLAYER_SETTINGS_DEFAULTS.SHOW_PLAYER_NAMES)
    this.settings.showTable = storage.getBool(PLAYER_SETTINGS.SHOW_TABLE, PLAYER_SETTINGS_DEFAULTS.SHOW_TABLE)
    this.settings.showPuzzleBackground = storage.getBool(PLAYER_SETTINGS.SHOW_PUZZLE_BACKGROUND, PLAYER_SETTINGS_DEFAULTS.SHOW_PUZZLE_BACKGROUND)
    this.settings.tableTexture = storage.getStr(PLAYER_SETTINGS.TABLE_TEXTURE, PLAYER_SETTINGS_DEFAULTS.TABLE_TEXTURE)
    this.settings.useCustomTableTexture = storage.getBool(PLAYER_SETTINGS.USE_CUSTOM_TABLE_TEXTURE, PLAYER_SETTINGS_DEFAULTS.USE_CUSTOM_TABLE_TEXTURE)
    this.settings.customTableTexture = storage.getStr(PLAYER_SETTINGS.CUSTOM_TABLE_TEXTURE, PLAYER_SETTINGS_DEFAULTS.CUSTOM_TABLE_TEXTURE)
    this.settings.customTableTextureScale = storage.getFloat(PLAYER_SETTINGS.CUSTOM_TABLE_TEXTURE_SCALE, PLAYER_SETTINGS_DEFAULTS.CUSTOM_TABLE_TEXTURE_SCALE)
    if (this.game.getMode() === MODE_REPLAY) {
      this.settings.background = storage.getStr(PLAYER_SETTINGS.COLOR_BACKGROUND, PLAYER_SETTINGS_DEFAULTS.COLOR_BACKGROUND)
      this.settings.color = storage.getStr(PLAYER_SETTINGS.PLAYER_COLOR, PLAYER_SETTINGS_DEFAULTS.PLAYER_COLOR)
      this.settings.name = storage.getStr(PLAYER_SETTINGS.PLAYER_NAME, PLAYER_SETTINGS_DEFAULTS.PLAYER_NAME)
    } else {
      this.settings.background = GameCommon.getPlayerBgColor(this.game.getGameId(), this.game.getClientId())
        || storage.getStr(PLAYER_SETTINGS.COLOR_BACKGROUND, PLAYER_SETTINGS_DEFAULTS.COLOR_BACKGROUND)
      this.settings.color = GameCommon.getPlayerColor(this.game.getGameId(), this.game.getClientId())
        || storage.getStr(PLAYER_SETTINGS.PLAYER_COLOR, PLAYER_SETTINGS_DEFAULTS.PLAYER_COLOR)
      this.settings.name = GameCommon.getPlayerName(this.game.getGameId(), this.game.getClientId())
        || storage.getStr(PLAYER_SETTINGS.PLAYER_NAME, PLAYER_SETTINGS_DEFAULTS.PLAYER_NAME)
    }
    this.settings.renderer = this.parseRenderer(storage.getStr(PLAYER_SETTINGS.RENDERER, PLAYER_SETTINGS_DEFAULTS.RENDERER))
  }

  parseRenderer(str: string): RendererType {
    if (!this.game.graphics.hasWebGL2Support()) {
      return RendererType.CANVAS
    }
    if (RendererType.WEBGL2 === str) {
      return RendererType.WEBGL2
    }
    if (RendererType.CANVAS === str) {
      return RendererType.CANVAS
    }
    return PLAYER_SETTINGS_DEFAULTS.RENDERER
  }

  apply(data: PlayerSettingsData) {
    this.setShowTable(data.showTable)
    this.setShowPuzzleBackground(data.showPuzzleBackground)
    this.setTableTexture(data.tableTexture)
    this.setUseCustomTableTexture(data.useCustomTableTexture)
    this.setCustomTableTexture(data.customTableTexture)
    this.setCustomTableTextureScale(data.customTableTextureScale)
    this.setBackground(data.background)
    this.setColor(data.color)
    this.setName(data.name)
    this.setSoundsEnabled(data.soundsEnabled)
    this.setOtherPlayerClickSoundEnabled(data.otherPlayerClickSoundEnabled)
    this.setRotateSoundEnabled(data.rotateSoundEnabled)
    this.setSoundsVolume(data.soundsVolume)
    this.setShowPlayerNames(data.showPlayerNames)
    this.setMouseRotate(data.mouseRotate)
    this.setRenderer(data.renderer)
  }

  getSettings(): PlayerSettingsData {
    return this.settings
  }

  showStatusMessage(what: string, value: number | string | boolean | undefined = undefined) {
    this.game.showStatusMessage(what, value)
  }

  setBackground(value: string) {
    if (this.settings.background !== value) {
      this.settings.background = value
      storage.setStr(PLAYER_SETTINGS.COLOR_BACKGROUND, value)
      this.showStatusMessage('Background', value)
      this.game.bgChange(value)
      return true
    }
    return false
  }

  setTableTexture(value: string) {
    if (this.settings.tableTexture !== value) {
      this.settings.tableTexture = value
      storage.setStr(PLAYER_SETTINGS.TABLE_TEXTURE, value)
      this.showStatusMessage('Table texture', value)
      this.game.changeTableTexture(value)
      return true
    }
    return false
  }

  setUseCustomTableTexture(value: boolean) {
    if (this.settings.useCustomTableTexture !== value) {
      this.settings.useCustomTableTexture = value
      storage.setBool(PLAYER_SETTINGS.USE_CUSTOM_TABLE_TEXTURE, value)
      this.showStatusMessage('Use custom table texture', value)
      this.game.changeUseCustomTableTexture(value)
      return true
    }
    return false
  }

  setCustomTableTexture(value: string) {
    if (this.settings.customTableTexture !== value) {
      this.settings.customTableTexture = value
      storage.setStr(PLAYER_SETTINGS.CUSTOM_TABLE_TEXTURE, value)
      this.showStatusMessage('Custom table texture', value)
      this.game.changeCustomTableTexture(value)
      return true
    }
    return false
  }

  setCustomTableTextureScale(value: number) {
    if (this.settings.customTableTextureScale !== value) {
      this.settings.customTableTextureScale = value
      storage.setFloat(PLAYER_SETTINGS.CUSTOM_TABLE_TEXTURE_SCALE, value)
      this.showStatusMessage('Custom table texture scale', value)
      this.game.changeCustomTableTextureScale(value)
      return true
    }
    return false
  }

  setShowTable(value: boolean) {
    if (this.settings.showTable !== value) {
      this.settings.showTable = value
      storage.setBool(PLAYER_SETTINGS.SHOW_TABLE, value)
      this.showStatusMessage('Table', value)
      this.game.changeShowTable(value)
      return true
    }
    return false
  }

  setShowPuzzleBackground(value: boolean) {
    if (this.settings.showPuzzleBackground !== value) {
      this.settings.showPuzzleBackground = value
      storage.setBool(PLAYER_SETTINGS.SHOW_PUZZLE_BACKGROUND, value)
      this.showStatusMessage('Puzzle Background/Preview', value)
      this.game.changeShowPuzzleBackground(value)
      return true
    }
    return false
  }

  setColor(value: string) {
    if (this.settings.color !== value) {
      this.settings.color = value
      storage.setStr(PLAYER_SETTINGS.PLAYER_COLOR, value)
      this.showStatusMessage('Color', value)
      this.game.changeColor(value)
      return true
    }
    return false
  }

  setName(value: string) {
    if (this.settings.name !== value) {
      this.settings.name = value
      storage.setStr(PLAYER_SETTINGS.PLAYER_NAME, value)
      this.showStatusMessage('Name', value)
      this.game.changeName(value)
      return true
    }
    return false
  }

  setMouseRotate(value: boolean) {
    if (this.settings.mouseRotate !== value) {
      this.settings.mouseRotate = value
      storage.setBool(PLAYER_SETTINGS.MOUSE_ROTATE, value)
      this.showStatusMessage('Mouse rotate', value)
      return true
    }
    return false
  }

  setOtherPlayerClickSoundEnabled(value: boolean) {
    if (this.settings.otherPlayerClickSoundEnabled !== value) {
      this.settings.otherPlayerClickSoundEnabled = value
      storage.setBool(PLAYER_SETTINGS.OTHER_PLAYER_CLICK_SOUND_ENABLED, value)
      this.showStatusMessage('Other player sounds', value)
      return true
    }
    return false
  }

  setRotateSoundEnabled(value: boolean) {
    if (this.settings.rotateSoundEnabled !== value) {
      this.settings.rotateSoundEnabled = value
      storage.setBool(PLAYER_SETTINGS.ROTATE_SOUND_ENABLED, value)
      this.showStatusMessage('Rotate sounds', value)
      return true
    }
    return false
  }

  setSoundsEnabled(value: boolean) {
    if (this.settings.soundsEnabled !== value) {
      this.settings.soundsEnabled = value
      storage.setBool(PLAYER_SETTINGS.SOUND_ENABLED, value)
      this.showStatusMessage('Sounds', value)
      return true
    }
    return false
  }

  setSoundsVolume(value: number) {
    if (this.settings.soundsVolume !== value) {
      this.settings.soundsVolume = value
      storage.setInt(PLAYER_SETTINGS.SOUND_VOLUME, value)
      this.showStatusMessage('Volume', value)
      this.game.changeSoundsVolume(value)
      return true
    }
    return false
  }

  setShowPlayerNames(value: boolean) {
    if (this.settings.showPlayerNames !== value) {
      this.settings.showPlayerNames = value
      storage.setBool(PLAYER_SETTINGS.SHOW_PLAYER_NAMES, value)
      this.showStatusMessage('Player names', value)
      return true
    }
    return false
  }

  setRenderer(value: RendererType) {
    if (this.settings.renderer !== value) {
      this.settings.renderer = value
      storage.setStr(PLAYER_SETTINGS.RENDERER, value)
      this.showStatusMessage('Renderer', value)
      return true
    }
  }

  toggleSoundsEnabled() {
    this.settings.soundsEnabled = !this.settings.soundsEnabled
    const value = this.settings.soundsEnabled
    storage.setBool(PLAYER_SETTINGS.SOUND_ENABLED, value)
    this.showStatusMessage('Sounds', value)
  }

  togglePlayerNames() {
    this.settings.showPlayerNames = !this.settings.showPlayerNames
    const value = this.settings.showPlayerNames
    storage.setBool(PLAYER_SETTINGS.SHOW_PLAYER_NAMES, value)
    this.showStatusMessage('Player names', value)
  }

  toggleShowTable() {
    this.settings.showTable = !this.settings.showTable
    const value = this.settings.showTable
    storage.setBool(PLAYER_SETTINGS.SHOW_TABLE, value)
    this.showStatusMessage('Table', value)
  }

  toggleShowPuzzleBackground() {
    this.settings.showPuzzleBackground = !this.settings.showPuzzleBackground
    const value = this.settings.showPuzzleBackground
    storage.setBool(PLAYER_SETTINGS.SHOW_PUZZLE_BACKGROUND, value)
    this.showStatusMessage('Puzzle Background/Preview', value)
  }

  soundsVolume() {
    return this.settings.soundsVolume
  }

  background() {
    return this.settings.background
  }

  color() {
    return this.settings.color
  }

  name() {
    return this.settings.name
  }

  otherPlayerClickSoundEnabled() {
    return this.settings.otherPlayerClickSoundEnabled
  }

  soundsEnabled() {
    return this.settings.soundsEnabled
  }

  rotateSoundEnabled() {
    return this.settings.rotateSoundEnabled
  }

  mouseRotate() {
    return this.settings.mouseRotate
  }

  renderer() {
    return this.settings.renderer
  }
}
