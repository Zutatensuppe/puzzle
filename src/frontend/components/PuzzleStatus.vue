<template>
  <div class="puzzle-status">
    <div>
      <icon icon="puzzle-piece" /> {{status.piecesDone}}/{{status.piecesTotal}}
    </div>
    <div>
      <icon icon="clock" v-if="!status.finished" />
      <icon icon="flag" v-else />
      {{durationStr}}
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { PuzzleStatus } from '../../common/Types'
import Time from './../../common/Time'

const props = defineProps<{
  status: PuzzleStatus,
}>()

const durationStr = computed(() => {
  return Time.durationStr(props.status.duration)
})
</script>
