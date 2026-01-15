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
      @click.stop="nsfwToggled = true"
    >
      😳 NSFW (click to show)
    </div>
    <div class="game-teaser-inner">
      <div
        v-tooltip="'Report this game'"
        class="report-button game-teaser-report"
        @click.stop="openReportGameDialog({ game })"
      />
      <div
        v-if="stateInfo"
        :class="['game-teaser-info', stateInfo.class]"
      >
        <v-icon :icon="stateInfo.icon" /> {{ stateInfo.text }}
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
          @click.stop="openImageInfoDialog({ image: game.image })"
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
import { computed, ref } from 'vue'
import { resizeUrl } from '@common/ImageService'
import Time from '@common/Time'
import type { GameInfo } from '@common/Types'
import { rotationModeToString, scoreModeToString, shapeModeToString, snapModeToString } from '@common/Util'
import { useNsfw } from '../../user'
import { useDialog } from '../../useDialog'

const { openReportGameDialog, openImageInfoDialog } = useDialog()

const props = defineProps<{
  game: GameInfo,
}>()

const emit = defineEmits<{
  (e: 'goToGame', val: GameInfo): void
  (e: 'goToReplay', val: GameInfo): void
}>()

const url = computed(() => resizeUrl(props.game.image.url, 375, 210, 'contain'))
const style = computed(() => ({ 'background-image': `url("${url.value}")` }))

const joinPuzzleText = computed(() => props.game.finished ? 'View puzzle' : 'Join puzzle')

const snapMode = computed(() => snapModeToString(props.game.snapMode))

const scoreMode = computed(() => scoreModeToString(props.game.scoreMode))

const shapeMode = computed(() => shapeModeToString(props.game.shapeMode))

const rotationMode = computed(() => rotationModeToString(props.game.rotationMode))

const { nsfwUnblurred } = useNsfw()
const nsfwToggled = ref<boolean>(false)
const hoverable = computed(() => (!props.game.image.nsfw || nsfwUnblurred.value || nsfwToggled.value))
const showNsfwInfo = computed(() => props.game.image.nsfw && !nsfwUnblurred.value && !nsfwToggled.value)
const time = (start: number, end: number) => {
  const from = start
  const to = end || Time.timestamp()
  const timeDiffStr = Time.timeDiffStr(from, to)
  return `${timeDiffStr}`
}

const stateInfo = computed<null | { class: string; text: string; icon: string }>(() => {
  if (props.game.isPrivate) {
    return {
      class: 'game-is-private-info',
      text: 'Private Game',
      icon: 'mdi-incognito',
    }
  }
  if (props.game.image.private) {
    return {
      class: 'image-is-private-info',
      text: 'Private Image',
      icon: 'mdi-incognito',
    }
  }

  if (props.game.image.state === 'pending_approval') {
    return {
      class: 'image-is-pending-info',
      text: 'Image pending',
      icon: 'mdi-clock-outline',
    }
  }

  if (props.game.image.state === 'rejected') {
    return {
      class: 'image-is-rejected-info',
      text: 'Image rejected',
      icon: 'mdi-cancel',
    }
  }

  return null
})
</script>
