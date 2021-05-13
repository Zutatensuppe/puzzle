"use strict"

import Time from './../../common/Time.js'

export default {
  name: 'game-teaser',
  props: {
    game: Object,
  },
  template: `
  <div class="game-teaser" :style="style">
    <router-link class="game-info" :to="{ name: 'game', params: { id: game.id } }">
      <span class="game-info-text">
        🧩 {{game.tilesFinished}}/{{game.tilesTotal}}<br />
        👥 {{game.players}}<br />
        {{time(game.started, game.finished)}}<br />
      </span>
    </router-link>
    <router-link v-if="false && game.hasReplay" class="game-replay" :to="{ name: 'replay', params: { id: game.id } }">
      ↪️ Watch replay
    </router-link>
  </div>`,
  computed: {
    style() {
      const url = this.game.imageUrl.replace('uploads/', 'uploads/r/') + '-375x210.webp'
      return {
        'background-image': `url("${url}")`,
      }
    },
  },
  methods: {
    time(start, end) {
      const icon = end ? '🏁' : '⏳'
      const from = start;
      const to = end || Time.timestamp()
      const timeDiffStr = Time.timeDiffStr(from, to)
      return `${icon} ${timeDiffStr}`
    },
  },
}
