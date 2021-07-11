import * as VueRouter from 'vue-router'
import * as Vue from 'vue'

import App from './App.vue'
import Index from './views/Index.vue'
import NewGame from './views/NewGame.vue'
import Game from './views/Game.vue'
import Replay from './views/Replay.vue'
import Util from './../common/Util'
import settings from './settings'
import xhr from './xhr'

(async () => {
  function initClientSecret() {
    let SECRET = settings.getStr('SECRET', '')
    if (!SECRET) {
      SECRET = Util.uniqId()
      settings.setStr('SECRET', SECRET)
    }
    return SECRET
  }
  function initClientId() {
    let ID = settings.getStr('ID', '')
    if (!ID) {
      ID = Util.uniqId()
      settings.setStr('ID', ID)
    }
    return ID
  }
  const clientId = initClientId()
  const clientSecret = initClientSecret()
  xhr.setClientId(clientId)
  xhr.setClientSecret(clientSecret)

  const res = await xhr.get(`/api/conf`, {})
  const conf = await res.json()

  const router = VueRouter.createRouter({
    history: VueRouter.createWebHashHistory(),
    routes: [
      { name: 'index', path: '/', component: Index },
      { name: 'new-game', path: '/new-game', component: NewGame },
      { name: 'game', path: '/g/:id', component: Game },
      { name: 'replay', path: '/replay/:id', component: Replay },
    ],
  })

  router.beforeEach((to, from) => {
    if (from.name) {
      document.documentElement.classList.remove(`view-${String(from.name)}`)
    }
    document.documentElement.classList.add(`view-${String(to.name)}`)
  })

  const app = Vue.createApp(App)
  app.config.globalProperties.$config = conf
  app.config.globalProperties.$clientId = clientId
  app.use(router)
  app.mount('#app')
})()
