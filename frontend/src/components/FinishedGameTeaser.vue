<template>
  <v-card
    class="finished-game-teaser"
    :class="{ 'game-is-private': game.isPrivate, hoverable }"
    elevation="10"
    @click="emit('goToGame', game)"
  >
    <div
      class="game-teaser-image"
      :style="style"
    />
    <div
      v-if="showNsfwInfo"
      class="teaser-nsfw-information"
      @click.stop="toggleNsfwItem(`${game.image.id}`)"
    >
      😳 NSFW (click to show)
    </div>
    <div class="game-teaser-inner">
      <div
        v-tooltip="'Report this game'"
        class="game-teaser-report"
        @click.stop="emit('reportClick', game)"
      >
        <v-icon icon="mdi-exclamation-thick" />
      </div>
      <div
        v-if="game.isPrivate"
        class="game-teaser-info game-is-private-info"
      >
        <v-icon icon="mdi-incognito" /> Private Game
      </div>
      <div class="game-teaser-info">
        <v-icon icon="mdi-puzzle" /> {{ game.piecesTotal }} Pieces
      </div>
      <div class="game-teaser-info">
        <v-icon icon="mdi-account-group" /> {{ game.players }} Player{{ game.players === 1 ? '' : 's' }}
      </div>
      <div class="game-teaser-info">
        <v-icon icon="mdi-flag-checkered" /> {{ time(game.started, game.finished) }}
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
        title="Rotation"
      >
        <v-icon icon="mdi-format-rotate-90" /> Rotation: {{ rotationMode }}
      </div>
      <div class="game-teaser-click-info">
        <h5>Click to {{ joinPuzzleText }}</h5>
      </div>
      <div class="game-teaser-buttons">
        <v-btn
          block
          size="x-small"
          class="show-image-info"
          prepend-icon="mdi-image"
          @click.stop="emit('showImageInfo', game.image)"
        >
          Image info
        </v-btn>
        <v-btn
          v-if="game.hasReplay"
          block
          color="info"
          size="x-small"
          class="mt-2"
          prepend-icon="mdi-play"
          @click.stop="emit('goToReplay', game)"
        >
          Watch replay
        </v-btn>
      </div>
    </div>
  </v-card>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { resizeUrl } from '../../../common/src/ImageService'
import Time from '../../../common/src/Time'
import { GameInfo, ImageInfo } from '../../../common/src/Types'
import { rotationModeToString, scoreModeToString, shapeModeToString, snapModeToString } from '../../../common/src/Util'
import { useNsfw } from '../user'

const props = defineProps<{
  game: GameInfo,
}>()

const emit = defineEmits<{
  (e: 'goToGame', val: GameInfo): void
  (e: 'goToReplay', val: GameInfo): void
  (e: 'showImageInfo', val: ImageInfo): void
  (e: 'reportClick', val: GameInfo): void
}>()

const url = computed(() => resizeUrl(props.game.image.url, 375, 210, 'contain'))
const style = computed(() => ({ 'background-image': `url("${url.value}")` }))

const joinPuzzleText = computed(() => props.game.finished ? 'View puzzle' : 'Join puzzle')

const snapMode = computed(() => snapModeToString(props.game.snapMode))

const scoreMode = computed(() => scoreModeToString(props.game.scoreMode))

const shapeMode = computed(() => shapeModeToString(props.game.shapeMode))

const rotationMode = computed(() => rotationModeToString(props.game.rotationMode))

const { showNsfw, toggleNsfwItem, nsfwItemsVisible } = useNsfw()
const hoverable = computed(() => (!props.game.image.nsfw || showNsfw.value || nsfwItemsVisible.value.includes(`${props.game.image.id}`)))
const showNsfwInfo = computed(() => props.game.image.nsfw && !showNsfw.value && !nsfwItemsVisible.value.includes(`${props.game.image.id}`))

const time = (start: number, end: number) => {
  const from = start
  const to = end || Time.timestamp()
  const timeDiffStr = Time.timeDiffStr(from, to)
  return `${timeDiffStr}`
}
</script>
