import _api from "./_api"

let conf: {
  WS_ADDRESS: string
}

const init = async () => {
  const confRes = await _api.pub.config()
  conf = await confRes.json()
}

const get = () => conf

export default {
  init,
  get,
}
