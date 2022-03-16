<template>
  <div class="puzzle-status">
    <div>
      <i class="icon icon-puzzle-piece" /> {{status.piecesDone}}/{{status.piecesTotal}}
    </div>
    <div>
      <i class="icon icon-clock" v-if="!this.status.finished" />
      <i class="icon icon-flag" v-else />
      {{durationStr}}
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
    durationStr (): string {
      return Time.durationStr(this.status.duration)
    },
  }
})
</script>
