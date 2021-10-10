<template>
  <overlay>
    <div class="preview">
      <div class="img" :style="previewStyle"></div>
    </div>
  </overlay>
</template>
<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'preview-overlay',
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
