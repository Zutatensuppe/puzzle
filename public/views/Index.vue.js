"use strict"

import Time from './../../common/Time.js'
import GameTeaser from './../components/GameTeaser.vue.js'
import NewGameDialog from './../components/NewGameDialog.vue.js'

export default {
  components: {
    GameTeaser,
    NewGameDialog,
  },
  template: `
<div id="app">
  <span class="btn" @click="showNewGameDialog = !showNewGameDialog">New game</span>
  <new-game-dialog
    v-if="showNewGameDialog"
    :images="images"
    @newGame="onNewGame"
    />

  <h1>Running games</h1>
  <div class="game-teaser-wrap" v-for="g in gamesRunning">
    <game-teaser :game="g" />
  </div>

  <h1>Finished games</h1>
  <div class="game-teaser-wrap" v-for="g in gamesFinished">
    <game-teaser :game="g" />
  </div>
</div>`,
  data() {
    return {
      showNewGameDialog: false,

      gamesRunning: [],
      gamesFinished: [],
      images: [],
    }
  },
  async created() {
    const res = await fetch('/api/index-data')
    const json = await res.json()
    this.gamesRunning = json.gamesRunning
    this.gamesFinished = json.gamesFinished
    this.images = json.images
  },
  methods: {
    time(start, end) {
      const icon = end ? '🏁' : '⏳'
      const from = start;
      const to = end || Time.timestamp()
      const timeDiffStr = Time.timeDiffStr(from, to)
      return `${icon} ${timeDiffStr}`
    },
    async onNewGame(gameSettings) {
      const res = await fetch('/newgame', {
        method: 'post',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(gameSettings),
      })
      if (res.status === 200) {
        const game = await res.json()
        location.assign(game.url)
      }
    }
  }
}
