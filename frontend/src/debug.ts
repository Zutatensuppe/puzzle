import GameCommon from '@common/GameCommon'
import Time from '@common/Time'
import storage from './storage'

let _debug = false
const isDebugEnabled = () => _debug
const checkDebug = () => {
  // in debug mode, expose some api to the window
  if (_debug) {
    // @ts-ignore
    window.htko_GameCommon = GameCommon
    // @ts-ignore
    window.htko_Time = Time
  } else {
    // @ts-ignore
    delete window.htko_GameCommon
    // @ts-ignore
    delete window.htko_Time
  }
}

const setDebugEnabled = (debug: boolean) => {
  storage.setBool('debug', debug)
  _debug = debug
  console.log('Debug mode:', debug)
  checkDebug()
}

const init = () => {
  _debug = storage.getBool('debug', false)
  checkDebug()

  // @ts-ignore
  window.htko_debug = {
    setEnabled: setDebugEnabled,
    isEnabled: isDebugEnabled,
  }
}

export default {
  init,
  isDebugEnabled,
}
