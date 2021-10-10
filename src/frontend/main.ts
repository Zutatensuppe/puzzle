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

import ConnectionOverlay from './components/ConnectionOverlay.vue'
import EditImageDialog from './components/EditImageDialog.vue'
import GameTeaser from './components/GameTeaser.vue'
import HelpOverlay from './components/HelpOverlay.vue'
import ImageLibrary from './components/ImageLibrary.vue'
import ImageTeaser from './components/ImageTeaser.vue'
import InfoOverlay from './components/InfoOverlay.vue'
import NewGameDialog from './components/NewGameDialog.vue'
import NewImageDialog from './components/NewImageDialog.vue'
import Overlay from './components/Overlay.vue'
import PreviewOverlay from './components/PreviewOverlay.vue'
import PuzzleStatus from './components/PuzzleStatus.vue'
import ResponsiveImage from './components/ResponsiveImage.vue'
import Scores from './components/Scores.vue'
import SettingsOverlay from './components/SettingsOverlay.vue'
import TagsInput from './components/TagsInput.vue'
import Upload from './components/Upload.vue'

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

  const meRes = await xhr.get(`/api/me`, {})
  const me = await meRes.json()

  const confRes = await xhr.get(`/api/conf`, {})
  const conf = await confRes.json()

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
  app.config.globalProperties.$me = me
  app.config.globalProperties.$config = conf
  app.config.globalProperties.$clientId = clientId
  app.use(router)
  app.component('connection-overlay', ConnectionOverlay)
  app.component('edit-image-dialog', EditImageDialog)
  app.component('game-teaser', GameTeaser)
  app.component('help-overlay', HelpOverlay)
  app.component('image-library', ImageLibrary)
  app.component('image-teaser', ImageTeaser)
  app.component('info-overlay', InfoOverlay)
  app.component('new-game-dialog', NewGameDialog)
  app.component('new-image-dialog', NewImageDialog)
  app.component('overlay', Overlay)
  app.component('preview-overlay', PreviewOverlay)
  app.component('puzzle-status', PuzzleStatus)
  app.component('responsive-image', ResponsiveImage)
  app.component('scores', Scores)
  app.component('settings-overlay', SettingsOverlay)
  app.component('tags-input', TagsInput)
  app.component('upload', Upload)
  app.mount('#app')
})()
