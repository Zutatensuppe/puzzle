import xhr from "./xhr"
import admin from './admin'
import pub from './pub'

export default {
  pub,
  admin,

  init: xhr.init,
  clientId: xhr.clientId,
}
