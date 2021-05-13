"use strict"

import Time from './../../common/Time.js'
import GameTeaser from './../components/GameTeaser.vue.js'

export default {
  components: {
    GameTeaser,
  },
  template: `
<div>
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
      gamesRunning: [],
      gamesFinished: [],
    }
  },
  async created() {
    const res = await fetch('/api/index-data')
    const json = await res.json()
    this.gamesRunning = json.gamesRunning
    this.gamesFinished = json.gamesFinished
  },
  methods: {
    time(start, end) {
      const icon = end ? '🏁' : '⏳'
      const from = start;
      const to = end || Time.timestamp()
      const timeDiffStr = Time.timeDiffStr(from, to)
      return `${icon} ${timeDiffStr}`
    },
  }
}
