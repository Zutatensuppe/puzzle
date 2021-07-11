<template>
  <div class="overlay transparent" @click="$emit('bgclick')">
    <table class="overlay-content help" @click.stop="">
      <tr>
        <td colspan="2">Info about this puzzle</td>
      </tr>
      <tr>
        <td>Image Title: </td>
        <td>{{game.puzzle.info.image.title}}</td>
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
  </div>
</template>
<script lang="ts">
import { defineComponent, PropType } from 'vue'
import { Game, ScoreMode, ShapeMode, SnapMode } from '../../common/Types'

export default defineComponent({
  name: 'help-overlay',
  emits: {
    bgclick: null,
  },
  props: {
    game: {
      type: Object as PropType<Game>,
      required: true,
    },
  },
  computed: {
    scoreMode () {
      switch (this.game.scoreMode) {
        case ScoreMode.ANY: return ['Any', 'Score when pieces are connected to each other or on final location']
        case ScoreMode.FINAL:
        default: return ['Final', 'Score when pieces are put to their final location']
      }
    },
    shapeMode () {
      switch (this.game.shapeMode) {
        case ShapeMode.FLAT: return ['Flat', 'All pieces flat on all sides']
        case ShapeMode.ANY: return ['Any', 'Flat pieces can occur anywhere']
        case ShapeMode.NORMAL:
        default:
          return ['Normal', '']
      }
    },
    snapMode () {
      switch (this.game.snapMode) {
        case SnapMode.REAL: return ['Real', 'Pieces snap only to corners, already snapped pieces and to each other']
        case SnapMode.NORMAL:
        default:
          return ['Normal', 'Pieces snap to final destination and to each other']
      }
    },
  },
})
</script>
