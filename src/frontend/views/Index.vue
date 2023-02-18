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

    <div class="running-games-and-leaderboard" :class="`games-count-${data.gamesRunning.items.length}`">
      <div class="running-games-container" v-if="data.gamesRunning.items.length">
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
          <v-tab value="week">Weekly</v-tab>
          <v-tab value="month">Monthly</v-tab>
          <v-tab value="alltime">Alltime</v-tab>
        </v-tabs>

        <v-window v-model="leaderboardTab">
          <v-window-item value="week">
            <p class="pt-2 pb-2 text-medium-emphasis">Finished puzzles within a week.</p>
            <Leaderboard v-if="leaderboardWeek" :lb="leaderboardWeek" />
          </v-window-item>
          <v-window-item value="month">
            <p class="pt-2 pb-2 text-medium-emphasis">Finished puzzles within a month.</p>
            <Leaderboard v-if="leaderboardMonth" :lb="leaderboardMonth" />
          </v-window-item>
          <v-window-item value="alltime">
            <p class="pt-2 pb-2 text-medium-emphasis">All finished puzzles.</p>
            <Leaderboard v-if="leaderboardAlltime" :lb="leaderboardAlltime" />
          </v-window-item>
        </v-window>
        <div class="mt-5 text-disabled" v-if="!me || me.type !== 'user'">
          <v-btn @click="login" density="comfortable">Login</v-btn> to show up on the leaderboard!
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
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router';
import { ApiDataFinishedGames, ApiDataIndexData } from '../../common/Types';
import RunningGameTeaser from '../components/RunningGameTeaser.vue';
import FinishedGameTeaser from '../components/FinishedGameTeaser.vue';
import Pagination from '../components/Pagination.vue';
import api from '../_api'
import Leaderboard from '../components/Leaderboard.vue';
import user, { User } from '../user';

const router = useRouter()
const data = ref<ApiDataIndexData | null>(null)
const me = ref<User|null>(null)

const onInit = async () => {
  me.value = user.getMe()
  const res = await api.pub.indexData()
  const json = await res.json() as ApiDataIndexData
  data.value = json
}

const login = () => {
  user.eventBus.emit('triggerLoginDialog')
}

const goToGame = ((game: any) => {
  router.push({ name: 'game', params: { id: game.id } })
})
const goToReplay = ((game: any) => {
  router.push({ name: 'replay', params: { id: game.id } })
})

const leaderboardTab = ref<string>('week')

const leaderboardWeek = computed(() => {
  return data.value?.leaderboards.find(lb => lb.name === 'week')
})
const leaderboardMonth = computed(() => {
  return data.value?.leaderboards.find(lb => lb.name === 'month')
})
const leaderboardAlltime = computed(() => {
  return data.value?.leaderboards.find(lb => lb.name === 'alltime')
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
  onInit()
  user.eventBus.on('login', onInit)
  user.eventBus.on('logout', onInit)
})
onBeforeUnmount(() => {
  user.eventBus.off('login', onInit)
  user.eventBus.off('logout', onInit)
})
</script>
