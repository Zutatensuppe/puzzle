<template>
  <v-card>
    <v-container :fluid="true">
      <h4>Info about this puzzle</h4>
      <v-table density="compact">
        <tbody>
          <tr>
            <td><v-icon icon="mdi-counter" /> Scoring: </td>
            <td><span :title="snapMode[1]">{{scoreMode[0]}}</span></td>
          </tr>
          <tr>
            <td><v-icon icon="mdi-shape" /> Shapes: </td>
            <td><span :title="snapMode[1]">{{shapeMode[0]}}</span></td>
          </tr>
          <tr>
            <td><v-icon icon="mdi-connection" /> Snapping: </td>
            <td><span :title="snapMode[1]">{{snapMode[0]}}</span></td>
          </tr>
        </tbody>
      </v-table>
      <h4 class="mt-5">Image</h4>
      <v-table density="compact">
        <tbody>
          <tr><td><v-icon icon="mdi-subtitles-outline" /> Title: </td><td>{{ image.title || '<No Title>' }}</td></tr>
          <tr v-if="image.copyrightURL || image.copyrightName">
            <td><v-icon icon="mdi-copyright" /> Copyright: </td>
            <td>
              <a :href="image.copyrightURL" v-if="image.copyrightURL" target="_blank">{{ image.copyrightName || 'Source' }} <v-icon icon="mdi-open-in-new" /></a>
              <span v-else>{{ image.copyrightName }}</span>
            </td>
          </tr>
          <tr><td><v-icon icon="mdi-account-arrow-up" /> Uploader: </td><td>{{ image.uploaderName || '<Unknown>' }}</td></tr>
          <tr><td><v-icon icon="mdi-account-arrow-up" /> Upload date: </td><td>{{ date }}</td></tr>
          <tr><td><v-icon icon="mdi-ruler-square" /> Dimensions: </td><td>{{ image.width }}x{{ image.height }}</td></tr>
          <tr><td><v-icon icon="mdi-tag" /> Tags: </td><td>{{ image.tags.length ? image.tags.map(t => t.title).join(', ') : '-' }}</td></tr>
          <tr><td><v-icon icon="mdi-puzzle" /> Game count: </td><td>{{ image.gameCount }}</td></tr>
        </tbody>
      </v-table>
    </v-container>
  </v-card>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { ScoreMode, ShapeMode, SnapMode } from '../../common/Types'
import { GamePlay } from '../GamePlay';
import { GameReplay } from '../GameReplay';

const props = defineProps<{
  game: GamePlay | GameReplay
}>()

const image = props.game.getImage()

const date = computed((): string => {
  // TODO: use date format that is same everywhere
  return new Date(image.created).toLocaleDateString()
})

const scoreMode = computed(() => {
  switch (props.game.getScoreMode()) {
    case ScoreMode.ANY: return ['Any', 'Score when pieces are connected to each other or on final location']
    case ScoreMode.FINAL:
    default: return ['Final', 'Score when pieces are put to their final location']
  }
})

const shapeMode = computed(() => {
  switch (props.game.getShapeMode()) {
    case ShapeMode.FLAT: return ['Flat', 'All pieces flat on all sides']
    case ShapeMode.ANY: return ['Any', 'Flat pieces can occur anywhere']
    case ShapeMode.NORMAL:
    default:
      return ['Normal', '']
  }
})

const snapMode = computed(() => {
  switch (props.game.getSnapMode()) {
    case SnapMode.REAL: return ['Real', 'Pieces snap only to corners, already snapped pieces and to each other']
    case SnapMode.NORMAL:
    default:
      return ['Normal', 'Pieces snap to final destination and to each other']
  }
})
</script>
<style scoped>
.v-table { background: transparent; }
</style>
