<template>
  <div class="overlay" @click="$emit('bgclick')">
    <div class="preview">
      <div class="img" :style="previewStyle"></div>
    </div>
  </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'preview-overlay',
  props: {
    img: String,
  },
  emits: {
    bgclick: null,
  },
  computed: {
    previewStyle (): object {
      return {
        backgroundImage: `url('${this.img}')`,
      }
    },
  },
})
</script>
