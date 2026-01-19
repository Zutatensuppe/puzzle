<template>
  <v-card
    class="preview-overlay"
    @click="emit('close')"
  >
    <div class="preview">
      <img
        class="img"
        :src="previewUrl"
        alt=""
      >
    </div>
  </v-card>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import type { GameInterface } from '../Game'

const props = defineProps<{
  game: GameInterface,
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const isAnimated = computed(() => props.game.getImage().animationFrames !== null)

const previewUrl = computed(() => {
  return isAnimated.value
    ? props.game.getImage().url
    : props.game.getPreviewImageUrl()
})
</script>
