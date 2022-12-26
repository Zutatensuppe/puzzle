<template>
  <v-container :fluid="true" class="index-view">
    <h1>Running games</h1>
    <v-container :fluid="true" class="pl-0 pr-0 game-teasers-holder">
      <GameTeaser
        v-for="(g, idx) in gamesRunning"
        :game="g"
        :key="idx"
        @goToGame="goToGame"
        @goToReplay="goToReplay"
      />
    </v-container>

    <h1>Finished games</h1>
    <v-container :fluid="true" class="pl-0 pr-0 game-teasers-holder">
      <GameTeaser
        v-for="(g, idx) in gamesFinished"
        :game="g"
        :key="idx"
        @goToGame="goToGame"
        @goToReplay="goToReplay"
      />
    </v-container>
  </v-container>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router';
import { GameInfo } from '../../common/Types';
import api from '../_api'
import GameTeaser from './../components/GameTeaser.vue';

const router = useRouter()
const gamesRunning = ref<GameInfo[]>([])
const gamesFinished = ref<GameInfo[]>([])

const goToGame = ((game: any) => {
  router.push({ name: 'game', params: { id: game.id } })
})
const goToReplay = ((game: any) => {
  router.push({ name: 'replay', params: { id: game.id } })
})

onMounted(async () => {
  const res = await api.pub.indexData()
  const json = await res.json()
  gamesRunning.value = json.gamesRunning
  gamesFinished.value = json.gamesFinished
})
</script>
