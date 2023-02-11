<template>
  <v-card class="finished-game-teaser" elevation="10" @click="emit('goToGame', game)">
    <div class="game-teaser-image" :style="style"></div>
    <div class="game-teaser-inner">
      <div class="game-teaser-info">
        <v-icon icon="mdi-puzzle"></v-icon> {{game.piecesTotal}} Pieces
      </div>
      <div class="game-teaser-info">
        <v-icon icon="mdi-account-group"></v-icon> {{game.players}} Player{{ game.players === 1 ? '' : 's' }}
      </div>
      <div class="game-teaser-info">
        <v-icon icon="mdi-flag-checkered"></v-icon> {{ time(game.started, game.finished) }}
      </div>
      <div class="game-teaser-info secondary" title="Scoring">
        <v-icon icon="mdi-counter"></v-icon> Scoring: {{ scoreMode }}
      </div>
      <div class="game-teaser-info secondary" title="Shapes">
        <v-icon icon="mdi-shape"></v-icon> Shapes: {{ shapeMode }}
      </div>
      <div class="game-teaser-info secondary" title="Snapping">
        <v-icon icon="mdi-connection"></v-icon> Snapping: {{ snapMode }}
      </div>
      <div class="game-teaser-click-info">
        <h5>Click to {{ joinPuzzleText }}</h5>
      </div>
      <div class="game-teaser-replay-info">
        <v-btn
          v-if="game.hasReplay"
          color="info"
          size="x-small"
          variant="elevated"
          class="game-replay"
          @click.prevent="emit('goToReplay', game)"
          prepend-icon="mdi-play"
        >
          Watch replay
        </v-btn>
      </div>
    </div>
  </v-card>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { resizeUrl } from '../../common/ImageService';
import Time from '../../common/Time'
import { GameInfo, ScoreMode, ShapeMode, SnapMode } from '../../common/Types'

const props = defineProps<{
  game: GameInfo,
}>()

const emit = defineEmits<{
  (e: 'goToGame', val: GameInfo): void
  (e: 'goToReplay', val: GameInfo): void
}>()

const url = computed(() => resizeUrl(props.game.imageUrl, 375, 210, 'contain'))
const style = computed(() => ({ 'background-image': `url("${url.value}")` }))

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
