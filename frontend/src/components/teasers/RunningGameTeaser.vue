<template>
  <v-card
    class="running-game-teaser"
    :class="{ 'game-is-private': game.isPrivate, hoverable }"
    elevation="10"
    @click="emit('goToGame', game)"
  >
    <div class="game-teaser-image-holder">
      <div
        class="game-teaser-image state-normal"
        :style="style"
      />
      <div
        v-if="hoverable && styleHovered"
        class="game-teaser-image state-hovered"
        :style="styleHovered"
      />
      <div
        v-if="showNsfwInfo"
        class="teaser-nsfw-information"
        @click.stop="nsfwToggled = true"
      >
        😳 NSFW (click to show)
      </div>
      <div class="game-teaser-banderole-holder">
        <div
          v-if="game.isPrivate"
          class="game-teaser-banderole game-is-private-info"
        >
          <v-icon icon="mdi-incognito" /> Private Game
        </div>
      </div>
    </div>

    <div class="game-teaser-inner">
      <div
        v-tooltip="'Report this game'"
        class="game-teaser-report"
        @click.stop="openReportGameDialog(game)"
      >
        <v-icon icon="mdi-exclamation-thick" />
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
        <v-icon icon="mdi-counter" /> Scoring: <span :class="{attention: scoreMode !== 'Any' }">{{ scoreMode }}</span>
      </div>
      <div
        class="game-teaser-info secondary"
        title="Shapes"
      >
        <v-icon icon="mdi-shape" /> Shapes: <span :class="{attention: shapeMode !== 'Normal' }">{{ shapeMode }}</span>
      </div>
      <div
        class="game-teaser-info secondary"
        title="Snapping"
      >
        <v-icon icon="mdi-connection" /> Snapping: <span :class="{attention: snapMode !== 'Normal' }">{{ snapMode }}</span>
      </div>
      <div
        class="game-teaser-info secondary"
        title="Snapping"
      >
        <v-icon icon="mdi-format-rotate-90" /> Rotation: <span :class="{attention: rotationMode !== 'None' }">{{ rotationMode }}</span>
      </div>

      <div class="game-teaser-buttons">
        <v-btn
          block
          prepend-icon="mdi-image"
          @click.stop="openImageInfoDialog(game.image)"
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
        <v-btn
          v-if="canDelete"
          color="error"
          block
          class="mt-4"
          prepend-icon="mdi-trash-can"
          @click.stop="emit('delete', game)"
        >
          Delete Game
        </v-btn>
      </div>
    </div>
  </v-card>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import Time from '../../../../common/src/Time'
import { resizeUrl } from '../../../../common/src/ImageService'
import type { GameInfo, User } from '../../../../common/src/Types'
import { rotationModeToString, scoreModeToString, shapeModeToString, snapModeToString } from '../../../../common/src/Util'
import user, { useNsfw } from '../../user'
import { useDialog } from '../../useDialog'

const { openReportGameDialog, openImageInfoDialog } = useDialog()

const props = defineProps<{
  game: GameInfo,
}>()

const emit = defineEmits<{
  (e: 'goToGame', val: GameInfo): void
  (e: 'delete', val: GameInfo): void
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

const { showNsfw } = useNsfw()
const nsfwToggled = ref<boolean>(false)
const hoverable = computed(() => (!props.game.image.nsfw || showNsfw.value || nsfwToggled.value))
const showNsfwInfo = computed(() => props.game.image.nsfw && !showNsfw.value && !nsfwToggled.value)

const time = ((start: number, end: number) => {
  const from = start
  const to = end || Time.timestamp()
  const timeDiffStr = Time.timeDiffStr(from, to)
  return `${timeDiffStr}`
})(props.game.started, props.game.finished)

const me = ref<User|null>(null)

const canDelete = computed(() => {
  return me.value && me.value.id === props.game.creatorUserId
})

const onInit = () => {
  me.value = user.getMe()
}
onMounted(() => {
  void onInit()
  user.eventBus.on('login', onInit)
  user.eventBus.on('logout', onInit)
})
onBeforeUnmount(() => {
  user.eventBus.off('login', onInit)
  user.eventBus.off('logout', onInit)
})
</script>
