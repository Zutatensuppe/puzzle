import * as VueRouter from 'vue-router'
import * as Vue from 'vue'

import App from './App.vue'
import Index from './views/Index.vue'
import NewGame from './views/NewGame.vue'
import FeaturedView from './views/FeaturedView.vue'
import Game from './views/Game.vue'
import Replay from './views/Replay.vue'
import CannyBugReportsView from './views/CannyBugReports.vue'
import CannyFeatureRequestsView from './views/CannyFeatureRequests.vue'

import Icon from './components/Icon.vue'
import user from './user'
import announcements from './announcements'

import Admin from './admin/views/IndexView.vue'
import AdminGames from './admin/views/GamesView.vue'
import AdminUsers from './admin/views/UsersView.vue'
import AdminImages from './admin/views/ImagesView.vue'
import AdminGroups from './admin/views/GroupsView.vue'
import AdminAnnouncements from './admin/views/AnnouncementsView.vue'
import AdminFeatured from './admin/views/FeaturedView.vue'
import AdminFeaturedEdit from './admin/views/FeaturedEditView.vue'
import debug from './debug'
import api from './_api'
import config from './config'

import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { init as initToast, toast } from './toast'

const run = async () => {
  debug.init()
  api.init()

  await user.init()
  await config.init()
  await announcements.init()

  // @ts-ignore
  window.handleAuthCallback = async () => {
    await user.init()
    toast('Login successful!', 'success')
  }

  const router = VueRouter.createRouter({
    history: VueRouter.createWebHistory(),
    routes: [
      { name: 'index', path: '/', component: Index, meta: { title: 'Jigsaw Hyottoko Club' } },
      { name: 'new-game', path: '/new-game', component: NewGame, meta: { title: 'New Game' } },
      { name: 'featured-artist', path: '/featured/:artist', component: FeaturedView, meta: { title: 'Featured Artist' } },
      { name: 'featured-category', path: '/featured-category/:category', component: FeaturedView, meta: { title: 'Featured Category' } },

      // Canny.io feedback
      { path: '/feedback', redirect: { name: 'bug-reports' } },
      { name: 'bug-reports', path: '/feedback/bug-reports', component: CannyBugReportsView, meta: { title: 'Bug Reports' } },
      { path: '/feedback/bug-reports/:catchAll(.*)', component: CannyBugReportsView, meta: { title: 'Bug Reports' } },
      { name: 'feature-requests', path: '/feedback/feature-requests', component: CannyFeatureRequestsView, meta: { title: 'Feature Requests' } },
      { path: '/feedback/feature-requests/:catchAll(.*)', component: CannyFeatureRequestsView, meta: { title: 'Feature Requests' } },

      // Ingame
      { name: 'game', path: '/g/:id', component: Game, meta: { ingame: true } },
      { name: 'replay', path: '/replay/:id', component: Replay, meta: { ingame: true } },

      // Admin
      { name: 'admin', path: '/admin', component: Admin, meta: { admin: true, title: 'Admin' } },
      { name: 'admin_games', path: '/admin/games', component: AdminGames, meta: { admin: true, title: 'Admin - Games' } },
      { name: 'admin_users', path: '/admin/users', component: AdminUsers, meta: { admin: true, title: 'Admin - Users' } },
      { name: 'admin_images', path: '/admin/images', component: AdminImages, meta: { admin: true, title: 'Admin - Images' } },
      { name: 'admin_groups', path: '/admin/groups', component: AdminGroups, meta: { admin: true, title: 'Admin - Groups' } },
      { name: 'admin_announcements', path: '/admin/announcements', component: AdminAnnouncements, meta: { admin: true, title: 'Admin - Announcements' } },
      { name: 'admin_featured', path: '/admin/featured', component: AdminFeatured, meta: { admin: true, title: 'Admin - Featured' } },
      { name: 'admin_featured_edit', path: '/admin/featured/:id', component: AdminFeaturedEdit, meta: { admin: true, title: 'Admin - Featured - Edit' } },
    ],
  })

  router.beforeEach((to, from) => {
    if (to.meta && to.meta.admin && !user.getMe()?.groups.includes('admin')) {
      return { name: 'index' }
    }
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
  initToast(app)
  app.component('Icon', Icon)
  app.mount('#app')
}

void run()
