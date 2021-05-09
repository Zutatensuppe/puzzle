"use strict"

import Time from './../../common/Time.js'

const GameTeaser = {
  name: 'game-teaser',
  props: {
    game: Object,
  },
  template: `
  <div class="game-teaser" :style="style">
    <a class="game-info" :href="'/g/' + game.id">
      <span class="game-info-text">
        🧩 {{game.tilesFinished}}/{{game.tilesTotal}}<br />
        👥 {{game.players}}<br />
        {{time(game.started, game.finished)}}<br />
      </span>
    </a>
    <a v-if="false && game.hasReplay" class="game-replay" :href="'/replay/' + game.id">
      ↪️ Watch replay
    </a>
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

export default GameTeaser
