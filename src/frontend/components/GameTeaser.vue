<template>
  <div class="game-teaser" :style="style">
    <router-link class="game-info" :to="{ name: 'game', params: { id: game.id } }">
      <span class="game-info-text">
        🧩 {{game.piecesFinished}}/{{game.piecesTotal}}<br />
        👥 {{game.players}}<br />
        {{time(game.started, game.finished)}}<br />
      </span>
    </router-link>
    <router-link v-if="game.hasReplay" class="game-replay" :to="{ name: 'replay', params: { id: game.id } }">
      ↪️ Watch replay
    </router-link>
  </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import Time from './../../common/Time'

export default defineComponent({
  props: {
    game: {
      type: Object,
      required: true,
    },
  },
  computed: {
    style (): object {
      const url = this.game.imageUrl.replace('uploads/', 'uploads/r/') + '-375x210.webp'
      return {
        'background-image': `url("${url}")`,
      }
    },
  },
  methods: {
    time(start: number, end: number) {
      const icon = end ? '🏁' : '⏳'
      const from = start;
      const to = end || Time.timestamp()
      const timeDiffStr = Time.timeDiffStr(from, to)
      return `${icon} ${timeDiffStr}`
    },
  },
})
</script>
