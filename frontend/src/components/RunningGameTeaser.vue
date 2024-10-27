<template>
  <v-card
    class="running-game-teaser"
    :class="{ 'game-is-private': game.isPrivate }"
    elevation="10"
    @click="emit('goToGame', game)"
  >
    <div class="game-teaser-image-holder">
      <div
        class="game-teaser-image state-normal"
        :style="style"
      />
      <div
        v-if="styleHovered"
        class="game-teaser-image state-hovered"
        :style="styleHovered"
      />
    </div>

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
        <v-icon icon="mdi-timer-outline" /> {{ time }}
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
      <div
        class="game-teaser-info secondary"
        title="Snapping"
      >
        <v-icon icon="mdi-format-rotate-90" /> Rotation: {{ rotationMode }}
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
import { GameInfo, ImageInfo } from '../../../common/src/Types'
import { rotationModeToString, scoreModeToString, shapeModeToString, snapModeToString } from '../../../common/src/Util'

const props = defineProps<{
  game: GameInfo,
}>()

const emit = defineEmits<{
  (e: 'goToGame', val: GameInfo): void
  (e: 'showImageInfo', val: ImageInfo): void
}>()

const style = computed(() => {
  const url = props.game.imageSnapshots.current
    ? props.game.imageSnapshots.current.url
    : props.game.image.url
  return { 'background-image': `url("${resizeUrl(url, 620, 496, 'contain')}")` }
})
const styleHovered = computed(() => {
  // when there is a snapshot, we show the full image on hover! this is
  // not a mistake here
  const url = props.game.imageSnapshots.current ? props.game.image.url : null
  return url ? { 'background-image': `url("${resizeUrl(url, 620, 496, 'contain')}")` } : null
})

const joinPuzzleText = computed(() => props.game.finished ? 'View puzzle' : 'Join puzzle')

const snapMode = computed(() => snapModeToString(props.game.snapMode))

const scoreMode = computed(() => scoreModeToString(props.game.scoreMode))

const shapeMode = computed(() => shapeModeToString(props.game.shapeMode))

const rotationMode = computed(() => rotationModeToString(props.game.rotationMode))

const time = ((start: number, end: number) => {
  const from = start
  const to = end || Time.timestamp()
  const timeDiffStr = Time.timeDiffStr(from, to)
  return `${timeDiffStr}`
})(props.game.started, props.game.finished)
</script>
