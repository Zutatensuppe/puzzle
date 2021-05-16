<template>
  <div>
    <h1>Running games</h1>
    <div class="game-teaser-wrap" v-for="(g, idx) in gamesRunning" :key="idx">
      <game-teaser :game="g" />
    </div>

    <h1>Finished games</h1>
    <div class="game-teaser-wrap" v-for="(g, idx) in gamesFinished" :key="idx">
      <game-teaser :game="g" />
    </div>
  </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'

import GameTeaser from './../components/GameTeaser.vue'

export default defineComponent({
  components: {
    GameTeaser,
  },
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
})
</script>
