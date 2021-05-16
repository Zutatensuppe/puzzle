import * as VueRouter from 'vue-router'
import * as Vue from 'vue'

import App from './App.vue'
import Index from './views/Index.vue'
import NewGame from './views/NewGame.vue'
import Game from './views/Game.vue'
import Replay from './views/Replay.vue'
import Util from './../common/Util'

(async () => {
  const res = await fetch(`/api/conf`)
  const conf = await res.json()

  function initme() {
    let ID = localStorage.getItem('ID')
    if (!ID) {
      ID = Util.uniqId()
      localStorage.setItem('ID', ID)
    }
    return ID
  }

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
  app.config.globalProperties.$clientId = initme()
  app.use(router)
  app.mount('#app')
})()
