<template>
  <div class="puzzle-status">
    <div>
      <icon icon="puzzle-piece" /> {{ status.piecesDone }}/{{ status.piecesTotal }}
    </div>
    <div>
      <icon
        v-if="!status.finished"
        icon="clock"
      />
      <icon
        v-else
        icon="flag"
      />
      {{ durationStr }}
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { PuzzleStatus } from '../../../common/src/Types'
import Time from './../../../common/src/Time'

const props = defineProps<{
  status: PuzzleStatus,
}>()

const durationStr = computed(() => {
  return Time.durationStr(props.status.duration)
})
</script>
