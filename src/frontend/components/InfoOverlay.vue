<template>
  <v-card class="transparent" @close="emit('close')">
    <table class="help">
      <tr>
        <td colspan="2">Info about this puzzle</td>
      </tr>
      <tr>
        <td>Image Title: </td>
        <td>{{game.puzzle.info.image?.title}}</td>
      </tr>
      <tr>
        <td>Scoring: </td>
        <td><span :title="snapMode[1]">{{scoreMode[0]}}</span></td>
      </tr>
      <tr>
        <td>Shapes: </td>
        <td><span :title="snapMode[1]">{{shapeMode[0]}}</span></td>
      </tr>
      <tr>
        <td>Snapping: </td>
        <td><span :title="snapMode[1]">{{snapMode[0]}}</span></td>
      </tr>
    </table>
  </v-card>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { Game, ScoreMode, ShapeMode, SnapMode } from '../../common/Types'

const props = defineProps<{
  game: Game
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const scoreMode = computed(() => {
  switch (props.game.scoreMode) {
    case ScoreMode.ANY: return ['Any', 'Score when pieces are connected to each other or on final location']
    case ScoreMode.FINAL:
    default: return ['Final', 'Score when pieces are put to their final location']
  }
})

const shapeMode = computed(() => {
  switch (props.game.shapeMode) {
    case ShapeMode.FLAT: return ['Flat', 'All pieces flat on all sides']
    case ShapeMode.ANY: return ['Any', 'Flat pieces can occur anywhere']
    case ShapeMode.NORMAL:
    default:
      return ['Normal', '']
  }
})

const snapMode = computed(() => {
  switch (props.game.snapMode) {
    case SnapMode.REAL: return ['Real', 'Pieces snap only to corners, already snapped pieces and to each other']
    case SnapMode.NORMAL:
    default:
      return ['Normal', 'Pieces snap to final destination and to each other']
  }
})
</script>
