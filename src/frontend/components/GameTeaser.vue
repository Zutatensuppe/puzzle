<template>
  <v-card class="game-teaser" elevation="10">
    <div class="game-teaser-image" :style="style"></div>
    <div class="game-teaser-inner">
      <div class="game-teaser-info">
        <v-icon icon="mdi-puzzle"></v-icon> {{game.piecesTotal}} Pieces ({{game.piecesFinished}} done)
      </div>
      <div class="game-teaser-info">
        <v-icon icon="mdi-account-group"></v-icon> {{game.players}} Players
      </div>
      <div class="game-teaser-info" title="Scoring">
        <v-icon icon="mdi-counter"></v-icon> {{ scoreMode }}
      </div>
      <div class="game-teaser-info" title="Shapes">
        <v-icon icon="mdi-shape"></v-icon> {{ shapeMode }}
      </div>
      <div class="game-teaser-info" title="Snapping">
        <v-icon icon="mdi-connection"></v-icon> {{ snapMode }}
      </div>
      <div class="game-teaser-info">
        <v-icon icon="mdi-timer-outline" v-if="!game.finished"></v-icon>
        <v-icon icon="mdi-flag-checkered" v-else></v-icon> {{time(game.started, game.finished)}}
      </div>
    </div>
    <v-card-actions class="d-flex justify-center">
      <v-btn
        class="game-join"
        color="success"
        variant="elevated"
        :to="{ name: 'game', params: { id: game.id } }"
        prepend-icon="mdi-puzzle"
      >
        {{ joinPuzzleText }}
      </v-btn>
      <v-btn
        v-if="game.finished && game.hasReplay"
        color="info"
        variant="elevated"
        class="game-replay"
        :to="{ name: 'replay', params: { id: game.id } }"
        prepend-icon="mdi-play"
      >
        Watch replay
      </v-btn>
    </v-card-actions>
  </v-card>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import Time from './../../common/Time'
import { GameInfo, ScoreMode, ShapeMode, SnapMode } from './../../common/Types'

const props = defineProps<{
  game: GameInfo
}>()

const url = props.game.imageUrl.replace('uploads/', 'uploads/r/') + '-375x210.webp'
const style = { 'background-image': `url("${url}")` }

const joinPuzzleText = computed(() => props.game.finished ? 'View puzzle' : 'Join puzzle')

const snapMode = computed(() => {
  switch (props.game.snapMode) {
    case SnapMode.REAL: return 'Real'
    case SnapMode.NORMAL:
    default:
      return 'Normal'
  }
})

const scoreMode = computed(() => {
  switch (props.game.scoreMode) {
    case ScoreMode.ANY: return 'Any'
    case ScoreMode.FINAL:
    default: return 'Final'
  }
})

const shapeMode = computed(() => {
  switch (props.game.shapeMode) {
    case ShapeMode.FLAT: return 'Flat'
    case ShapeMode.ANY: return 'Any'
    case ShapeMode.NORMAL:
    default:
      return 'Normal'
  }
})

const time = (start: number, end: number) => {
  const from = start;
  const to = end || Time.timestamp()
  const timeDiffStr = Time.timeDiffStr(from, to)
  return `${timeDiffStr}`
}
</script>
