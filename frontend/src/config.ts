import _api from './_api'
import type { Api } from './Types'

let conf: Api.ConfigResponseData

const init = async () => {
  const confRes = await _api.pub.config()
  conf = await confRes.json()
}

const get = () => conf

export default {
  init,
  get,
}
