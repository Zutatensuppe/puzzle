<template>
  <v-container
    v-if="data"
    :fluid="true"
    class="index-view"
  >
    <v-row class="mt-2 mb-2">
      <v-col>
        <div class="text-center">
          <v-btn
            class="font-weight-bold mb-1"
            :to="{ name: 'new-game' }"
            prepend-icon="mdi-puzzle-outline"
            size="large"
            color="info"
          >
            Start a new Puzzle
          </v-btn>
        </div>
      </v-col>
    </v-row>

    <h1
      v-if="data.livestreams.length > 0"
      class="mt-5"
    >
      Live on Twitch
    </h1>
    <v-container
      v-if="data.livestreams.length > 0"
      :fluid="true"
      class="pl-0 pr-0 live-on-twitch"
    >
      <div class="d-flex ga-3">
        <template
          v-for="livestream of data.livestreams"
          :key="livestream.id"
        >
          <v-tooltip>
            <p>
              <strong>{{ livestream.user_display_name }}</strong>
            </p>
            <p>
              {{ livestream.title }}
            </p>
            <p>
              {{ livestream.viewers }} viewers
            </p>
            <template #activator="{ props }">
              <a
                :href="livestream.url"
                target="_blank"
                v-bind="props"
              >
                <img :src="livestream.user_thumbnail">
              </a>
            </template>
          </v-tooltip>
        </template>
      </div>
    </v-container>

    <div
      class="running-games-and-leaderboard"
      :class="`games-count-${data.gamesRunning.items.length}`"
    >
      <div
        v-if="data.gamesRunning.items.length"
        class="running-games-container"
      >
        <h1>Running games</h1>
        <v-container
          :fluid="true"
          class="pl-0 pr-0 game-teasers-holder running-games"
        >
          <RunningGameTeaser
            v-for="(g, idx) in data.gamesRunning.items"
            :key="idx"
            :game="g"
            @go-to-game="goToGame"
            @delete="onDeleteGameClick(g)"
          />
        </v-container>
      </div>

      <div
        v-if="leaderboards.length > 0"
        class="leaderboard-container"
      >
        <h1>Leaderboard</h1>
        <v-tabs v-model="leaderboardTab">
          <v-tab
            v-for="lb in leaderboards"
            :key="lb.id"
            :value="lb.name"
          >
            {{ leaderboardConfigs[lb.name].title || lb.name }}
          </v-tab>
        </v-tabs>
        <v-window v-model="leaderboardTab">
          <v-window-item
            v-for="lb in leaderboards"
            :key="lb.id"
            :value="lb.name"
          >
            <p class="pt-2 pb-2 text-medium-emphasis">
              {{ leaderboardConfigs[lb.name].description || lb.name }}
            </p>
            <Leaderboard :lb="lb" />
          </v-window-item>
        </v-window>
        <div
          v-if="me?.type !== 'user'"
          class="mt-5 text-disabled"
        >
          <v-btn
            density="comfortable"
            @click="openLoginDialog"
          >
            Login
          </v-btn> to show up on the leaderboard!
        </div>
      </div>
    </div>

    <template v-if="data.gamesFinished.items.length">
      <h1 class="mt-5">
        Finished games
      </h1>
      <Pagination
        :pagination="data.gamesFinished.pagination"
        @click="onPagination"
      />
      <v-container
        :fluid="true"
        class="pl-0 pr-0 game-teasers-holder finished-games"
      >
        <FinishedGameTeaser
          v-for="(g, idx) in data.gamesFinished.items"
          :key="idx"
          :game="g"
          @go-to-game="goToGame"
          @go-to-replay="goToReplay"
        />
      </v-container>
      <Pagination
        :pagination="data.gamesFinished.pagination"
        @click="onPagination"
      />
    </template>
  </v-container>
</template>
<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import type { Api, GameInfo } from '@common/Types'
import RunningGameTeaser from '../components/teasers/RunningGameTeaser.vue'
import FinishedGameTeaser from '../components/teasers/FinishedGameTeaser.vue'
import Pagination from '../components/Pagination.vue'
import api from '../_api'
import Leaderboard from '../components/Leaderboard.vue'
import { me, onLoginStateChange } from '../user'
import { toast } from '../toast'
import { useDialog } from '../useDialog'

const { closeDialog, openLoginDialog, openConfirmDeleteDialog } = useDialog()

const router = useRouter()
const data = ref<Api.ApiDataIndexData | null>(null)

const onInit = async () => {
  const res = await api.pub.indexData()
  data.value = await res.json()
}

const goToGame = ((game: GameInfo) => {
  void router.push({ name: 'game', params: { id: game.id } })
})

const goToReplay = ((game: GameInfo) => {
  void router.push({ name: 'replay', params: { id: game.id } })
})

const onDeleteGameClick = (game: GameInfo) => {
  openConfirmDeleteDialog({
    game,
    onConfirmDeleteGame: async (game: GameInfo): Promise<void> => {
      try {
        const res = await api.pub.deleteGame(game.id)
        const responseData = await res.json()
        if (responseData.ok) {
          closeDialog()
          // remove the game from the list of running games without reloading everything
          data.value!.gamesRunning.items = data.value!.gamesRunning.items.filter(g => g.id !== game.id)
          toast('Game deleted successfully.', 'success', 7000)
        } else {
          toast(`Failed to delete game: ${responseData.error}`, 'error')
        }
      } catch {
        toast('Failed to delete game.', 'error')
      }
    },
  })
}

const leaderboardConfigs: Record<string, { title: string, description: string }> = {
  week: {
    title: 'Weekly',
    description: 'Finished puzzles within a week.',
  },
  month: {
    title: 'Monthly',
    description: 'Finished puzzles within a month.',
  },
  alltime: {
    title: 'Alltime',
    description: 'All finished puzzles.',
  },
}
const leaderboards = computed(() => {
  const list = []
  for (const key of Object.keys(leaderboardConfigs)) {
    const lb = data.value?.leaderboards.find(lb => lb.name === key)
    if (lb) {
      list.push(lb)
    }
  }
  return list
})
const leaderboardTab = ref<string>(leaderboards.value[0]?.name || '')

const onPagination = async (q: { limit: number, offset: number }) => {
  if (!data.value) {
    return
  }
  const res = await api.pub.finishedGames(q)
  const json = await res.json()
  if ('error' in json) {
    toast(`Failed to load finished games: ${json.error}`, 'error')
    return
  }
  data.value.gamesFinished = json
}


let offLoginStateChange: () => void = () => {}
onMounted(async () => {
  await onInit()
  offLoginStateChange = onLoginStateChange(onInit)
})

onUnmounted(() => {
  offLoginStateChange()
})
</script>
