<template>
  <v-card
    class="running-game-teaser"
    :class="{ 'game-is-private': game.isPrivate }"
    elevation="10"
    @click="emit('goToGame', game)"
  >
    <div
      class="game-teaser-image"
      :style="style"
    />
    <div class="game-teaser-inner">
      <div
        v-if="game.isPrivate"
        class="game-teaser-info game-is-private-info"
      >
        <v-icon icon="mdi-incognito" /> Private Game
      </div>
      <div class="game-teaser-info">
        <v-icon icon="mdi-puzzle" /> {{ game.piecesFinished }}/{{ game.piecesTotal }} Pieces
      </div>
      <div class="game-teaser-info">
        <v-icon icon="mdi-account-group" /> {{ game.players }} Active Player{{ game.players === 1 ? '' : 's' }}
      </div>
      <div class="game-teaser-info secondary">
        <v-icon icon="mdi-timer-outline" /> {{ time(game.started, game.finished) }}
      </div>
      <div
        class="game-teaser-info secondary"
        title="Scoring"
      >
        <v-icon icon="mdi-counter" /> Scoring: {{ scoreMode }}
      </div>
      <div
        class="game-teaser-info secondary"
        title="Shapes"
      >
        <v-icon icon="mdi-shape" /> Shapes: {{ shapeMode }}
      </div>
      <div
        class="game-teaser-info secondary"
        title="Snapping"
      >
        <v-icon icon="mdi-connection" /> Snapping: {{ snapMode }}
      </div>

      <div class="game-teaser-buttons">
        <v-btn
          block
          prepend-icon="mdi-image"
          @click.stop="emit('showImageInfo', game.image)"
        >
          Image info
        </v-btn>
        <v-btn
          color="success"
          block
          class="mt-4"
        >
          {{ joinPuzzleText }}
        </v-btn>
      </div>
    </div>
  </v-card>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import Time from '../../../common/src/Time'
import { resizeUrl } from '../../../common/src/ImageService'
import { GameInfo, ImageInfo, ScoreMode, ShapeMode, SnapMode } from '../../../common/src/Types'

const props = defineProps<{
  game: GameInfo,
}>()

const emit = defineEmits<{
  (e: 'goToGame', val: GameInfo): void
  (e: 'showImageInfo', val: ImageInfo): void
}>()

const url = computed(() => resizeUrl(props.game.image.url, 620, 496, 'contain'))
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
  const from = start
  const to = end || Time.timestamp()
  const timeDiffStr = Time.timeDiffStr(from, to)
  return `${timeDiffStr}`
}
</script>