<template>
  <v-container :fluid="true" class="index-view" v-if="data">
    <v-row class="mt-2 mb-2">
      <v-col>
        <div class="text-center">
          <v-btn
            class="font-weight-bold mb-1"
            :to="{ name: 'new-game' }"
            prepend-icon="mdi-puzzle-outline"
            size="large"
            color="info"
          >Start a new Puzzle</v-btn>
        </div>
      </v-col>
    </v-row>

    <div class="running-games-and-leaderboard">
      <div class="running-games-container">
        <h1>Running games</h1>
        <v-container :fluid="true" class="pl-0 pr-0 game-teasers-holder running-games">
          <RunningGameTeaser
            v-for="(g, idx) in data.gamesRunning.items"
            :game="g"
            :key="idx"
            @goToGame="goToGame"
            @goToReplay="goToReplay"
          />
        </v-container>
      </div>

      <div class="leaderboard-container">
        <h1>Leaderboard</h1>
        <v-tabs v-model="leaderboardTab">
          <v-tab value="overall" title="All finished puzzles">Overall</v-tab>
          <v-tab value="1000+" title="Only puzzles with 1000 and more pieces"><v-icon icon="mdi-puzzle"/> 1000+</v-tab>
          <v-tab value="500+" title="Only puzzles with 500 - 999 pieces"><v-icon icon="mdi-puzzle"/> 500+</v-tab>
          <v-tab value="100+" title="Only puzzles with 100 - 499 pieces"><v-icon icon="mdi-puzzle"/> 100+</v-tab>
        </v-tabs>

        <v-window v-model="leaderboardTab">
          <v-window-item value="overall">
            <Leaderboard v-if="leaderboardOverall" :lb="leaderboardOverall" />
          </v-window-item>
          <v-window-item value="1000+">
            <Leaderboard v-if="leaderboard1000" :lb="leaderboard1000" />
          </v-window-item>
          <v-window-item value="500+">
            <Leaderboard v-if="leaderboard500" :lb="leaderboard500" />
          </v-window-item>
          <v-window-item value="100+">
            <Leaderboard v-if="leaderboard100" :lb="leaderboard100" />
          </v-window-item>
        </v-window>
        <div class="mt-2 text-caption text-disabled">
          ※ only registered users show up on the leaderboard
        </div>
      </div>
    </div>

    <h1 class="mt-5">Finished games</h1>
    <Pagination :pagination="data.gamesFinished.pagination" @click="onPagination" />
    <v-container :fluid="true" class="pl-0 pr-0 game-teasers-holder finished-games">
      <FinishedGameTeaser
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
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router';
import { ApiDataFinishedGames, ApiDataIndexData } from '../../common/Types';
import RunningGameTeaser from '../components/RunningGameTeaser.vue';
import FinishedGameTeaser from '../components/FinishedGameTeaser.vue';
import Pagination from '../components/Pagination.vue';
import api from '../_api'
import Leaderboard from '../components/Leaderboard.vue';

const router = useRouter()
const data = ref<ApiDataIndexData | null>(null)

const goToGame = ((game: any) => {
  router.push({ name: 'game', params: { id: game.id } })
})
const goToReplay = ((game: any) => {
  router.push({ name: 'replay', params: { id: game.id } })
})

const leaderboardTab = ref<string>('overall')

const leaderboardOverall = computed(() => {
  return data.value?.leaderboards.find(lb => lb.name === 'overall')
})
const leaderboard1000 = computed(() => {
  return data.value?.leaderboards.find(lb => lb.name === '1000+')
})
const leaderboard500 = computed(() => {
  return data.value?.leaderboards.find(lb => lb.name === '500+')
})
const leaderboard100 = computed(() => {
  return data.value?.leaderboards.find(lb => lb.name === '100+')
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
