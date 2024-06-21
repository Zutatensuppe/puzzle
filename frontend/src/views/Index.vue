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
            @show-image-info="showImageInfo"
          />
        </v-container>
      </div>

      <div class="leaderboard-container" v-if="leaderboardWeek || leaderboardMonth || leaderboardAlltime">
        <h1>Leaderboard</h1>
        <v-tabs v-model="leaderboardTab">
          <v-tab value="week" v-if="leaderboardWeek">
            Weekly
          </v-tab>
          <v-tab value="month" v-if="leaderboardMonth">
            Monthly
          </v-tab>
          <v-tab value="alltime" v-if="leaderboardAlltime">
            Alltime
          </v-tab>
        </v-tabs>

        <v-window v-model="leaderboardTab">
          <v-window-item value="week" v-if="leaderboardWeek">
            <p class="pt-2 pb-2 text-medium-emphasis">
              Finished puzzles within a week.
            </p>
            <Leaderboard
              :lb="leaderboardWeek"
            />
          </v-window-item>
          <v-window-item value="month" v-if="leaderboardMonth">
            <p class="pt-2 pb-2 text-medium-emphasis">
              Finished puzzles within a month.
            </p>
            <Leaderboard
              :lb="leaderboardMonth"
            />
          </v-window-item>
          <v-window-item value="alltime" v-if="leaderboardAlltime">
            <p class="pt-2 pb-2 text-medium-emphasis">
              All finished puzzles.
            </p>
            <Leaderboard
              :lb="leaderboardAlltime"
            />
          </v-window-item>
        </v-window>
        <div
          v-if="!me || me.type !== 'user'"
          class="mt-5 text-disabled"
        >
          <v-btn
            density="comfortable"
            @click="login"
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
          @show-image-info="showImageInfo"
        />
      </v-container>
      <Pagination
        :pagination="data.gamesFinished.pagination"
        @click="onPagination"
      />
    </template>
  </v-container>

  <v-dialog v-model="dialog">
    <ImageInfoDialog
      v-if="imageInfo"
      :image="imageInfo"
      @tag-click="onTagClick"
      @close="dialog = false"
    />
  </v-dialog>
</template>
<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ApiDataFinishedGames, ApiDataIndexData, GameInfo, ImageInfo, ImageSearchSort, Tag } from '../../../common/src/Types'
import RunningGameTeaser from '../components/RunningGameTeaser.vue'
import FinishedGameTeaser from '../components/FinishedGameTeaser.vue'
import Pagination from '../components/Pagination.vue'
import api from '../_api'
import Leaderboard from '../components/Leaderboard.vue'
import user, { User } from '../user'
import ImageInfoDialog from '../components/ImageInfoDialog.vue'

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

const goToGame = ((game: GameInfo) => {
  router.push({ name: 'game', params: { id: game.id } })
})
const goToReplay = ((game: GameInfo) => {
  router.push({ name: 'replay', params: { id: game.id } })
})

const dialog = ref<boolean>(false)
const imageInfo = ref<ImageInfo|null>(null)
const showImageInfo = ((image: ImageInfo) => {
  dialog.value = true
  imageInfo.value = image
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

const onTagClick = (tag: Tag): void => {
  router.push({ name: 'new-game', query: { sort: ImageSearchSort.DATE_DESC, search: tag.title } })
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
