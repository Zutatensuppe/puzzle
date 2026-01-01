import type { Api } from '@common/Types'
import _api from './_api'

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
