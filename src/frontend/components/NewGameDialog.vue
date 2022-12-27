<template>
  <v-card class="new-game-dialog">
    <v-card-title>New Game</v-card-title>

    <v-container :fluid="true">
      <v-row>
        <v-col :lg="8">
          <div class="has-image" style="min-height: 50vh;">
            <ResponsiveImage :src="image.url" :title="image.title" />
          </div>
        </v-col>
        <v-col :lg="4" class="area-settings">
          <v-tabs v-model="tab">
            <v-tab value="settings">Settings</v-tab>
            <v-tab value="image-info">Image Info</v-tab>
          </v-tabs>

          <v-window v-model="tab">
            <v-window-item value="settings">
              <div>
                <v-text-field density="compact" v-model="tiles" label="Pieces" />
              </div>
              <div>
                <v-label><v-icon icon="mdi-counter mr-1"></v-icon> Scoring</v-label>
                <v-radio-group v-model="scoreMode" density="comfortable">
                  <v-radio label="Any (Score when pieces are connected to each other or on final location)" :value="1"></v-radio>
                  <v-radio label="Final (Score when pieces are put to their final location)" :value="0"></v-radio>
                </v-radio-group>
              </div>
              <div>
                <v-label><v-icon icon="mdi-shape mr-1"></v-icon> Shapes</v-label>
                <v-radio-group v-model="shapeMode" density="comfortable">
                  <v-radio label="Normal" :value="0"></v-radio>
                  <v-radio label="Any (Flat pieces can occur anywhere)" :value="1"></v-radio>
                  <v-radio label="Flat (All pieces flat on all sides)" :value="2"></v-radio>
                </v-radio-group>
              </div>
              <div>
                <v-label><v-icon icon="mdi-connection mr-1"></v-icon> Snapping</v-label>
                <v-radio-group v-model="snapMode" density="comfortable">
                  <v-radio label="Normal (Pieces snap to final destination and to each other)" :value="0"></v-radio>
                  <v-radio label="Real (Pieces snap only to corners, already snapped pieces and to each other)" :value="1"></v-radio>
                </v-radio-group>
              </div>
              <div>
                <v-label><v-icon icon="mdi-incognito mr-1"></v-icon> Privacy</v-label>
                <v-checkbox density="comfortable" label="Private Game (Private games won't show up in the game overview)" v-model="isPrivate" :disabled="forcePrivate"></v-checkbox>
              </div>

              <v-card-actions>
                <v-btn
                  variant="elevated"
                  :disabled="!canStartNewGame"
                  @click="onNewGameClick"
                  prepend-icon="mdi-puzzle"
                  color="success"
                >Generate Puzzle</v-btn>
                <v-btn
                  variant="elevated"
                  @click="emit('close')"
                  color="error"
                >Cancel</v-btn>
              </v-card-actions>
            </v-window-item>
            <v-window-item value="image-info">
              <v-table>
                <tbody>
                  <tr><td>Title: </td><td>{{ image.title || '<No Title>' }}</td></tr>
                  <tr><td>Upload date: </td><td>{{ date }}</td></tr>
                  <tr><td>Dimensions: </td><td>{{ image.width }}x{{ image.height }}</td></tr>
                  <tr><td>Tags: </td><td>{{ image.tags.length ? image.tags.map(t => t.title).join(', ') : '-' }}</td></tr>
                  <tr><td>Game count: </td><td>{{ image.gameCount || 0 }}</td></tr>
                </tbody>
              </v-table>
            </v-window-item>
          </v-window>
        </v-col>
      </v-row>
    </v-container>
  </v-card>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'

import { GameSettings, ImageInfo, ScoreMode, ShapeMode, SnapMode } from './../../common/Types'
import ResponsiveImage from './ResponsiveImage.vue';

const props = defineProps<{
  image: ImageInfo
  forcePrivate: boolean
}>()

const emit = defineEmits<{
  (e: 'newGame', val: GameSettings): void
  (e: 'close'): void
}>()

const tab = ref<string>('settings')

const tiles = ref<string | number>(1000)
const isPrivate = ref<boolean>(props.forcePrivate)
const scoreMode = ref<ScoreMode>(ScoreMode.ANY)
const shapeMode = ref<ShapeMode>(ShapeMode.NORMAL)
const snapMode = ref<SnapMode>(SnapMode.NORMAL)

const date = computed((): string => {
  // TODO: use date format that is same everywhere
  return new Date(props.image.created).toLocaleDateString()
})

const canStartNewGame = computed((): boolean => {
  if (
    !tilesInt.value
    || !props.image
    || !props.image.url
    || ![0, 1].includes(scoreModeInt.value)
  ) {
    return false
  }
  return true
})
const scoreModeInt = computed((): number => {
  return parseInt(`${scoreMode.value}`, 10)
})
const shapeModeInt = computed((): number => {
  return parseInt(`${shapeMode.value}`, 10)
})
const snapModeInt = computed((): number => {
  return parseInt(`${snapMode.value}`, 10)
})
const tilesInt = computed((): number => {
  return parseInt(`${tiles.value}`, 10)
})

const onNewGameClick = () => {
  emit('newGame', {
    tiles: tilesInt.value,
    private: isPrivate.value,
    image: props.image,
    scoreMode: scoreModeInt.value,
    shapeMode: shapeModeInt.value,
    snapMode: snapModeInt.value,
  })
}
</script>
