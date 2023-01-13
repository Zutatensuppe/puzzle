<template>
  <Nav @show-login="loginDialogTab = 'login'; showLogin = true;" />
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

    <h1>Finished games</h1>
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
  <LoginDialog
    v-if="showLogin"
    v-model="showLogin"
    @close="showLogin=false"
    :tab="loginDialogTab"
    :token="passwordResetToken"
  />
</template>
<script setup lang="ts">
import LoginDialog from '../components/LoginDialog.vue';
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router';
import { ApiDataFinishedGames, ApiDataIndexData } from '../../common/Types';
import RunningGameTeaser from '../components/RunningGameTeaser.vue';
import FinishedGameTeaser from '../components/FinishedGameTeaser.vue';
import Pagination from '../components/Pagination.vue';
import api from '../_api'
import Nav from '../components/Nav.vue';
import user from '../user';

const router = useRouter()
const data = ref<ApiDataIndexData | null>(null)

const passwordResetToken = ref<string>('')

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

const showLogin = ref<boolean>(false);
const loginDialogTab = ref<'login' | 'register' | 'forgot-password' | 'reset-password' | undefined>(undefined)

const onInit = () => {
  showLogin.value = false
}

onMounted(async () => {
  user.eventBus.on('login', onInit)

  const res = await api.pub.indexData()
  const json = await res.json() as ApiDataIndexData
  data.value = json

  if (window.location.hash) {
    const urlParams = new URLSearchParams(window.location.hash.replace("#","?"));
    const t = urlParams.get('password-reset');
    if (t) {
      loginDialogTab.value = 'reset-password'
      showLogin.value = true
      passwordResetToken.value= t
    }
  }
})

onBeforeUnmount(() => {
  user.eventBus.off('login', onInit)
})
</script>
