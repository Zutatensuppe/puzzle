<template>
  <div>
    <h1>Running games</h1>
    <GameTeaser v-for="(g, idx) in gamesRunning" :key="idx" :game="g" />

    <h1>Finished games</h1>
    <GameTeaser v-for="(g, idx) in gamesFinished" :key="idx" :game="g" />
  </div>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { GameInfo } from '../../common/Types';
import api from '../_api'
import GameTeaser from './../components/GameTeaser.vue';

const gamesRunning = ref<GameInfo[]>([])
const gamesFinished = ref<GameInfo[]>([])

onMounted(async () => {
  const res = await api.pub.indexData()
  const json = await res.json()
  gamesRunning.value = json.gamesRunning
  gamesFinished.value = json.gamesFinished
})
</script>
