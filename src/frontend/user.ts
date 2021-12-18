import xhr from "./xhr";

let me: any = null;

async function init() {
  const meRes = await xhr.get(`/api/me`, {})
  me = await meRes.json()
}

export default {
  getMe: () => {
    return me
  },
  init,
}
