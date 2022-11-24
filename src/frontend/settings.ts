/**
 * Player settings
 */

export const SETTINGS = {
  SOUND_VOLUME: 'sound_volume',
  SOUND_ENABLED: 'sound_enabled',
  OTHER_PLAYER_CLICK_SOUND_ENABLED: 'other_player_click_sound_enabled',
  COLOR_BACKGROUND: 'bg_color',
  SHOW_TABLE: 'show_table',
  TABLE_TEXTURE: 'table_texture',
  PLAYER_COLOR: 'player_color',
  PLAYER_NAME: 'player_name',
  SHOW_PLAYER_NAMES: 'show_player_names',
}

export const DEFAULTS = {
  SOUND_VOLUME: 100,
  SOUND_ENABLED: true,
  OTHER_PLAYER_CLICK_SOUND_ENABLED: true,
  COLOR_BACKGROUND: '#222222',
  SHOW_TABLE: true,
  TABLE_TEXTURE: 'dark',
  PLAYER_COLOR: '#ffffff',
  PLAYER_NAME: 'anon',
  SHOW_PLAYER_NAMES: true,
}

export interface PlayerSettings {
  background: string
  showTable: boolean
  tableTexture: string
  color: string
  name: string
  soundsEnabled: boolean
  otherPlayerClickSoundEnabled: boolean
  soundsVolume: number
  showPlayerNames: boolean
}

export const defaultPlayerSettings = (): PlayerSettings => ({
  background: '',
  showTable: true,
  tableTexture: 'dark',
  color: '',
  name: '',
  soundsEnabled: true,
  otherPlayerClickSoundEnabled: true,
  soundsVolume: 100,
  showPlayerNames: true,
})

const set = (setting: string, value: string): void => {
  localStorage.setItem(setting, value)
}

const get = (setting: string): any => {
  return localStorage.getItem(setting)
}

const setInt = (setting: string, val: number): void => {
  set(setting, `${val}`)
}

const getInt = (setting: string, def: number): number => {
  const value = get(setting)
  if (value === null) {
    return def
  }
  const vol = parseInt(value, 10)
  return isNaN(vol) ? def : vol
}

const setBool = (setting: string, val: boolean): void => {
  set(setting, val ? '1' : '0')
}

const getBool = (setting: string, def: boolean): boolean => {
  const value = get(setting)
  if (value === null) {
    return def
  }
  return value === '1'
}

const setStr = (setting: string, val: string): void => {
  set(setting, val)
}

const getStr = (setting: string, def: string): string => {
  const value = get(setting)
  if (value === null) {
    return def
  }
  return value
}

export default {
  setInt,
  getInt,
  setBool,
  getBool,
  setStr,
  getStr,
}
