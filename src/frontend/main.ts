import * as VueRouter from 'vue-router'
import * as Vue from 'vue'

import App from './App.vue'
import Index from './views/Index.vue'
import NewGame from './views/NewGame.vue'
import Game from './views/Game.vue'
import Replay from './views/Replay.vue'

import Icon from './components/Icon.vue'
import user from './user'

import Admin from './admin/views/Index.vue'
import AdminGames from './admin/views/Games.vue'
import AdminUsers from './admin/views/Users.vue'
import AdminImages from './admin/views/Images.vue'
import AdminGroups from './admin/views/Groups.vue'
import api from './_api'
import config from './config'

import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

(async () => {
  api.init()

  await user.init()
  await config.init()

  window.handleAuthCallback = async () => {
    await user.init()
  }

  const router = VueRouter.createRouter({
    history: VueRouter.createWebHistory(),
    routes: [
      { name: 'index', path: '/', component: Index, meta: { title: 'Jigsaw Hyottoko Club' } },
      { name: 'new-game', path: '/new-game', component: NewGame, meta: { title: 'New Game' } },
      { name: 'game', path: '/g/:id', component: Game },
      { name: 'replay', path: '/replay/:id', component: Replay },

      { name: 'admin', path: '/admin', component: Admin },
      { name: 'admin_games', path: '/admin/games', component: AdminGames },
      { name: 'admin_users', path: '/admin/users', component: AdminUsers },
      { name: 'admin_images', path: '/admin/images', component: AdminImages },
      { name: 'admin_groups', path: '/admin/groups', component: AdminGroups },
    ],
  })

  router.beforeEach((to, from) => {
    if (from.name) {
      document.documentElement.classList.remove(`view-${String(from.name)}`)
    }
    document.documentElement.classList.add(`view-${String(to.name)}`)
  })

  const vuetify = createVuetify({
    components,
    directives,
  })

  const app = Vue.createApp(App)
  app.use(router)
  app.use(vuetify)
  app.component('icon', Icon)
  app.mount('#app')
})()
