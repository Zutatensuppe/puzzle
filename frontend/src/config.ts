import _api from './_api'
import { ConfigResponseData } from './Types'

let conf: ConfigResponseData

const init = async () => {
  const confRes = await _api.pub.config()
  conf = await confRes.json()
}

const get = () => conf

export default {
  init,
  get,
}
