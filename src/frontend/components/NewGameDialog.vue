<template>
  <v-card class="new-game-dialog">
    <v-card-title>New Game</v-card-title>

    <v-container :fluid="true">
      <v-row no-gutters>
        <v-col :lg="8">
          <div class="has-image">
            <ResponsiveImage :src="image.url" :title="image.title" />
          </div>
          <div class="image-title" v-if="image.title || image.width || image.height">
            <span class="image-title-title" v-if="image.title">"{{image.title}}"</span>
            <span class="image-title-dim" v-if="image.width || image.height">({{image.width}} ✕ {{image.height}})</span>
          </div>
        </v-col>
        <v-col :lg="4" class="area-settings">
          <table>
            <tr>
              <td><v-text-field density="compact" v-model="tiles" label="Pieces" /></td>
            </tr>
            <tr>
              <td>
                <v-radio-group v-model="scoreMode" density="comfortable" label="Scoring">
                  <v-radio label="Any (Score when pieces are connected to each other or on final location)" :value="1"></v-radio>
                  <v-radio label="Final (Score when pieces are put to their final location)" :value="0"></v-radio>
                </v-radio-group>
              </td>
            </tr>
            <tr>
              <td>
                <v-radio-group v-model="shapeMode" density="comfortable" label="Shapes">
                  <v-radio label="Normal" :value="0"></v-radio>
                  <v-radio label="Any (Flat pieces can occur anywhere)" :value="1"></v-radio>
                  <v-radio label="Flat (All pieces flat on all sides)" :value="2"></v-radio>
                </v-radio-group>
              </td>
            </tr>
            <tr>
              <td>
                <v-radio-group v-model="snapMode" density="comfortable" label="Snapping">
                  <v-radio label="Normal (Pieces snap to final destination and to each other)" :value="0"></v-radio>
                  <v-radio label="Real (Pieces snap only to corners, already snapped pieces and to each other)" :value="1"></v-radio>
                </v-radio-group>
              </td>
            </tr>
            <tr>
              <td>
                <v-label>Privacy</v-label>
                <v-checkbox density="comfortable" label="Private Game (Private games won't show up in the game overview)" v-model="isPrivate" :disabled="forcePrivate"></v-checkbox>
              </td>
            </tr>
            <tr v-if="image.tags.length">
              <td>
                <v-label>Image Tags</v-label>
                <div class="pt-2">
                  <v-chip v-for="(tag,idx) in image.tags" :key="idx">{{ tag.title }}</v-chip>
                </div>
              </td>
            </tr>
          </table>
        </v-col>
      </v-row>
    </v-container>

    <v-card-actions>
      <v-btn
        variant="elevated"
        :disabled="!canStartNewGame"
        @click="onNewGameClick"
        prepend-icon="mdi-puzzle"
      >Generate Puzzle</v-btn>
      <v-btn
        variant="elevated"
        @click="emit('close')"
      >Cancel</v-btn>
    </v-card-actions>
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

const tiles = ref<string | number>(1000)
const isPrivate = ref<boolean>(props.forcePrivate)
const scoreMode = ref<ScoreMode>(ScoreMode.ANY)
const shapeMode = ref<ShapeMode>(ShapeMode.NORMAL)
const snapMode = ref<SnapMode>(SnapMode.NORMAL)

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
