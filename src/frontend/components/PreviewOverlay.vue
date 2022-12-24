<template>
  <v-card class="preview-overlay">
    <div class="preview">
      <div class="img" :style="previewStyle"></div>
    </div>
  </v-card>
</template>
<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  img: string
}>()

const previewStyle = computed(() => {
  return {
    backgroundImage: `url('${props.img}')`,
  }
})
</script>
