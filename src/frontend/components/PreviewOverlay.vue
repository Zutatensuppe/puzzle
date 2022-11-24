<template>
  <overlay class="preview-overlay" @close="emit('close')">
    <template v-slot:default>
      <div class="preview">
        <div class="img" :style="previewStyle"></div>
      </div>
    </template>
  </overlay>
</template>
<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  img: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const previewStyle = computed(() => {
  return {
    backgroundImage: `url('${props.img}')`,
  }
})
</script>
