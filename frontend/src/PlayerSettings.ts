import { MODE_REPLAY } from './GameMode'
import storage from './storage'
import GameCommon from '../../common/src/GameCommon'
import { Game } from './Game'
import { PLAYER_SETTINGS, PLAYER_SETTINGS_DEFAULTS, PlayerSettingsData } from '../../common/src/Types'

export class PlayerSettings {

  private settings!: PlayerSettingsData

  constructor(private game: Game<any>) {
    // pass
  }

  init() {
    this.settings = {} as PlayerSettingsData
    this.settings.soundsVolume = storage.getInt(PLAYER_SETTINGS.SOUND_VOLUME, PLAYER_SETTINGS_DEFAULTS.SOUND_VOLUME)
    this.settings.otherPlayerClickSoundEnabled = storage.getBool(PLAYER_SETTINGS.OTHER_PLAYER_CLICK_SOUND_ENABLED, PLAYER_SETTINGS_DEFAULTS.OTHER_PLAYER_CLICK_SOUND_ENABLED)
    this.settings.soundsEnabled = storage.getBool(PLAYER_SETTINGS.SOUND_ENABLED, PLAYER_SETTINGS_DEFAULTS.SOUND_ENABLED)
    this.settings.showPlayerNames = storage.getBool(PLAYER_SETTINGS.SHOW_PLAYER_NAMES, PLAYER_SETTINGS_DEFAULTS.SHOW_PLAYER_NAMES)
    this.settings.showTable = storage.getBool(PLAYER_SETTINGS.SHOW_TABLE, PLAYER_SETTINGS_DEFAULTS.SHOW_TABLE)
    this.settings.tableTexture = storage.getStr(PLAYER_SETTINGS.TABLE_TEXTURE, PLAYER_SETTINGS_DEFAULTS.TABLE_TEXTURE)
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
  }

  getSettings(): PlayerSettingsData {
    return this.settings
  }

  showStatusMessage(what: string, value: any = undefined) {
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

  setOtherPlayerClickSoundEnabled(value: boolean) {
    if (this.settings.otherPlayerClickSoundEnabled !== value) {
      this.settings.otherPlayerClickSoundEnabled = value
      storage.setBool(PLAYER_SETTINGS.OTHER_PLAYER_CLICK_SOUND_ENABLED, value)
      this.showStatusMessage('Other player sounds', value)
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

  showTable() {
    return this.settings.showTable
  }

  tableTexture() {
    return this.settings.tableTexture
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

  showPlayerNames() {
    return this.settings.showPlayerNames
  }
}
