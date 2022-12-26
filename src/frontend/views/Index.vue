<template>
  <v-container :fluid="true" class="index-view" v-if="data">
    <h1>Running games</h1>
    <v-container :fluid="true" class="pl-0 pr-0 game-teasers-holder">
      <GameTeaser
        v-for="(g, idx) in data.gamesRunning.items"
        :game="g"
        :key="idx"
        @goToGame="goToGame"
        @goToReplay="goToReplay"
      />
    </v-container>

    <h1>Finished games</h1>
    <Pagination :pagination="data.gamesFinished.pagination" @click="onPagination" />
    <v-container :fluid="true" class="pl-0 pr-0 game-teasers-holder">
      <GameTeaser
        v-for="(g, idx) in data.gamesFinished.items"
        :game="g"
        :key="idx"
        @goToGame="goToGame"
        @goToReplay="goToReplay"
      />
    </v-container>
    <Pagination :pagination="data.gamesFinished.pagination" @click="onPagination" />
  </v-container>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router';
import { ApiDataFinishedGames, ApiDataIndexData } from '../../common/Types';
import Pagination from '../components/Pagination.vue';
import api from '../_api'
import GameTeaser from './../components/GameTeaser.vue';

const router = useRouter()
const data = ref<ApiDataIndexData | null>(null)

const goToGame = ((game: any) => {
  router.push({ name: 'game', params: { id: game.id } })
})
const goToReplay = ((game: any) => {
  router.push({ name: 'replay', params: { id: game.id } })
})

const onPagination = async (q: { limit: number, offset: number }) => {
  if (!data.value) {
    return
  }
  const res = await api.pub.finishedGames(q)
  const json = await res.json() as ApiDataFinishedGames
  data.value.gamesFinished = json
}

onMounted(async () => {
  const res = await api.pub.indexData()
  const json = await res.json() as ApiDataIndexData
  data.value = json
})
</script>
