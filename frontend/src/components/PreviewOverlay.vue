<template>
  <v-card
    class="preview-overlay"
    @click="emit('close')"
  >
    <div class="preview">
      <div
        class="img"
        :style="previewStyle"
      />
    </div>
  </v-card>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { GamePlay } from '../GamePlay'
import { GameReplay } from '../GameReplay'

const props = defineProps<{
  game: GamePlay | GameReplay
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const previewStyle = computed(() => {
  return {
    backgroundImage: `url('${props.game.getPreviewImageUrl()}')`,
  }
})
</script>
