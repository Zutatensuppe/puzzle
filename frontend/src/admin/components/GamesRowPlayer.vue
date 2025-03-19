<template>
  <div :style="style">
    {{ name }} ({{ points }})
  </div>
</template>
<script setup lang="ts">
import { computed, StyleValue } from 'vue'
import { EncodedPlayer, EncodedPlayerIdx } from '../../../../common/src/Types'

const props = defineProps<{
  player: EncodedPlayer
}>()

const name = computed(() => props.player[EncodedPlayerIdx.NAME])
const points = computed(() => props.player[EncodedPlayerIdx.POINTS])
const style = computed((): StyleValue => {
  if (props.player[5] === 'ukraine') {
    return {
      backgroundImage: 'linear-gradient(180deg, rgba(0,87,183,1) 0%, rgba(0,87,183,1) 50%, rgba(255,221,0,1) 50%)',
      '-webkit-background-clip': 'text',
      '-webkit-text-fill-color': 'transparent',
    }
  }
  return {
    color: props.player[EncodedPlayerIdx.COLOR] || 'white',
  }
})
</script>
