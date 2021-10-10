<template>
  <overlay class="preview-overlay" :animate="false">
    <template v-slot:default>
      <div class="preview">
        <div class="img" :style="previewStyle"></div>
      </div>
    </template>
  </overlay>
</template>
<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  props: {
    img: String,
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
