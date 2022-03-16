<template>
  <div class="game-teaser" :style="style">
    <router-link class="game-info" :to="{ name: 'game', params: { id: game.id } }">
      <span class="game-info-text">
        <i class="icon icon-puzzle-piece" /> {{game.tilesFinished}}/{{game.tilesTotal}}<br />
        <i class="icon icon-sillouette" /> {{game.players}}<br />
        <i class="icon icon-clock" v-if="!game.finished" />
        <i class="icon icon-flag" v-else /> {{time(game.started, game.finished)}}<br />
      </span>
    </router-link>
    <router-link v-if="game.hasReplay" class="game-replay" :to="{ name: 'replay', params: { id: game.id } }">
      <i class="icon icon-replay" /> Watch replay
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
      const from = start;
      const to = end || Time.timestamp()
      const timeDiffStr = Time.timeDiffStr(from, to)
      return `${timeDiffStr}`
    },
  },
})
</script>
