<template>
  <v-container :fluid="true" class="index-view">
    <h1>Running games</h1>
    <v-container :fluid="true" class="pl-0 pr-0">
      <v-row v-for="(_, iIndex) in gamesRunningRowCount">
        <v-col v-for="(_, jIndex) in colCount">
          <GameTeaser v-if="gamesRunning[iIndex * colCount + jIndex]" :game="gamesRunning[iIndex * colCount + jIndex]" />
        </v-col>
      </v-row>
    </v-container>

    <h1>Finished games</h1>
    <v-container :fluid="true" class="pl-0 pr-0">
      <v-row v-for="(_, iIndex) in gamesFinishedRowCount">
        <v-col v-for="(_, jIndex) in colCount">
          <GameTeaser v-if="gamesFinished[iIndex * colCount + jIndex]" :game="gamesFinished[iIndex * colCount + jIndex]" />
        </v-col>
      </v-row>
    </v-container>
  </v-container>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { GameInfo } from '../../common/Types';
import api from '../_api'
import GameTeaser from './../components/GameTeaser.vue';

const colCount = 5
const gamesRunning = ref<GameInfo[]>([])
const gamesFinished = ref<GameInfo[]>([])

const calculateRowCount = (arr: any[]) => {
  return Math.floor(arr.length / colCount) + (arr.length % colCount === 0 ? 0 : 1)
}

const gamesRunningRowCount = computed(() => calculateRowCount(gamesRunning.value))
const gamesFinishedRowCount = computed(() => calculateRowCount(gamesFinished.value))

onMounted(async () => {
  const res = await api.pub.indexData()
  const json = await res.json()
  gamesRunning.value = json.gamesRunning
  gamesFinished.value = json.gamesFinished
})
</script>
