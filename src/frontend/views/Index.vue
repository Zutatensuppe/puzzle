<template>
  <div>
    <h1>Running games</h1>
    <game-teaser v-for="(g, idx) in gamesRunning" :key="idx" :game="g" />

    <h1>Finished games</h1>
    <game-teaser v-for="(g, idx) in gamesFinished" :key="idx" :game="g" />
  </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import api from '../_api'

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
    const res = await api.pub.indexData()
    const json = await res.json()
    this.gamesRunning = json.gamesRunning
    this.gamesFinished = json.gamesFinished
  },
})
</script>
