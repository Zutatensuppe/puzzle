<template>
  <overlay class="new-game-dialog" @close="emit('close')">
    <template v-slot:default>
      <div class="area-image">
        <div class="has-image">
          <responsive-image :src="image.url" :title="image.title" />
        </div>
        <div class="image-title" v-if="image.title || image.width || image.height">
          <span class="image-title-title" v-if="image.title">"{{image.title}}"</span>
          <span class="image-title-dim" v-if="image.width || image.height">({{image.width}} ✕ {{image.height}})</span>
        </div>
      </div>

      <div class="area-settings">
        <table>
          <tr>
            <td><label>Pieces</label></td>
            <td><input type="text" v-model="tiles" /></td>
          </tr>
          <tr>
            <td><label>Scoring: </label></td>
            <td>
              <label><input type="radio" v-model="scoreMode" value="1" />
              Any (Score when pieces are connected to each other or on final location)</label>
              <br />
              <label><input type="radio" v-model="scoreMode" value="0" />
              Final (Score when pieces are put to their final location)</label>
            </td>
          </tr>
          <tr>
            <td><label>Shapes: </label></td>
            <td>
              <label><input type="radio" v-model="shapeMode" value="0" />
              Normal</label>
              <br />
              <label><input type="radio" v-model="shapeMode" value="1" />
              Any (Flat pieces can occur anywhere)</label>
              <br />
              <label><input type="radio" v-model="shapeMode" value="2" />
              Flat (All pieces flat on all sides)</label>
            </td>
          </tr>
          <tr>
            <td><label>Snapping: </label></td>
            <td>
              <label><input type="radio" v-model="snapMode" value="0" />
              Normal (Pieces snap to final destination and to each other)</label>
              <br />
              <label><input type="radio" v-model="snapMode" value="1" />
              Real (Pieces snap only to corners, already snapped pieces and to each other)</label>
            </td>
          </tr>
          <tr>
            <td><label>Private Game</label></td>
            <td class="checkbox-only"><input :disabled="forcePrivate" type="checkbox" v-model="isPrivate" /></td>
          </tr>
          <tr>
            <td colspan="2">
              <div class="hint">Private games won't show up in the game overview.</div>
            </td>
          </tr>
          <tr v-if="image.tags.length">
            <td><label>Tags: </label></td>
            <td>
              <span v-for="(tag,idx) in image.tags" :key="idx" class="bit">{{ tag.title }}</span>
            </td>
          </tr>
        </table>
      </div>

      <div class="area-buttons">
        <button class="btn" :disabled="!canStartNewGame" @click="onNewGameClick">
          <icon icon="puzzle-piece" /> Generate Puzzle
        </button>
        <button class="btn" @click="emit('close')">Cancel</button>
      </div>
    </template>
  </overlay>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'

import { GameSettings, ImageInfo, ScoreMode, ShapeMode, SnapMode } from './../../common/Types'

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
