<template>
  <div class="overlay transparent" @click="$emit('bgclick')">
    <table class="overlay-content help" @click.stop="">
      <tr>
        <td colspan="2">Info about this puzzle</td>
      </tr>
      <tr>
        <td>Image Title: </td>
        <td>{{game.puzzle.info.imageTitle}}</td>
      </tr>
      <tr>
        <td>Snap Mode: </td>
        <td>{{scoreMode[0]}}</td>
      </tr>
      <tr>
        <td>Shape Mode: </td>
        <td>{{shapeMode[0]}}</td>
      </tr>
      <tr>
        <td>Score Mode: </td>
        <td>{{snapMode[0]}}</td>
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
        case ShapeMode.FLAT: return ['Flat', 'all pieces flat on all sides']
        case ShapeMode.ANY: return ['Any', 'flat pieces can occur anywhere']
        case ShapeMode.NORMAL:
        default:
          return ['Normal', '']
      }
    },
    snapMode () {
      switch (this.game.snapMode) {
        case SnapMode.REAL: return ['Real', 'pieces snap only to corners, already snapped pieces and to each other']
        case SnapMode.NORMAL:
        default:
          return ['Normal', 'pieces snap to final destination and to each other']
      }
    },
  },
})
</script>
