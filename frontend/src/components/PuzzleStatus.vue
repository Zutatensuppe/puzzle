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
import Time from './../../../common/src/Time'
import { GameStatus } from '../../../common/src/Types'

const props = defineProps<{
  status: GameStatus,
}>()

const durationStr = computed(() => {
  return Time.durationStr(props.status.duration)
})
</script>
