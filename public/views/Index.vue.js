"use strict"

import Time from './../../common/Time.js'
import GameTeaser from './../components/GameTeaser.vue.js'
import NewGameDialog from './../components/NewGameDialog.vue.js'

export default {
  components: {
    GameTeaser,
    NewGameDialog,
  },
  // TODO: use vue router
  template: `
<div id="app">
  <ul class="nav">
    <li><span class="btn" @click="view = 'index'">Home</span></li>
    <li><span class="btn" @click="view = 'new-game'">New game</span></li>
  </ul>

  <new-game-dialog v-if="view === 'new-game'"
    :images="images"
    @newGame="onNewGame"
    />

  <div v-if="view === 'index'">
    <h1>Running games</h1>
    <div class="game-teaser-wrap" v-for="g in gamesRunning">
      <game-teaser :game="g" />
    </div>

    <h1>Finished games</h1>
    <div class="game-teaser-wrap" v-for="g in gamesFinished">
      <game-teaser :game="g" />
    </div>
  </div>
</div>`,
  data() {
    return {
      view: 'index',

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
