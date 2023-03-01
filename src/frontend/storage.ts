import Util from '../common/Util'

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

const uniq = (str: string) => {
  let val = getStr(str, '')
  if (!val) {
    val = Util.uniqId()
    setStr(str, val)
  }
  return val
}

export default {
  setInt,
  getInt,
  setBool,
  getBool,
  setStr,
  getStr,
  uniq,
}
