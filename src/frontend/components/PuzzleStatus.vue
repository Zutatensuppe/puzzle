<template>
  <div class="puzzle-status">
    <div>
      🧩 {{status.piecesDone}}/{{status.piecesTotal}}
    </div>
    <div>
      {{icon}} {{durationStr}}
    </div>
  </div>
</template>
<script lang="ts">
import { defineComponent, PropType } from 'vue'
import { PuzzleStatus } from '../../common/Types'
import Time from './../../common/Time'

export default defineComponent({
  props: {
    status: {
      type: Object as PropType<PuzzleStatus>,
      required: true,
    },
  },
  computed: {
    icon (): string {
      return this.status.finished ? '🏁' : '⏳'
    },
    durationStr (): string {
      return Time.durationStr(this.status.duration)
    },
  }
})
</script>
