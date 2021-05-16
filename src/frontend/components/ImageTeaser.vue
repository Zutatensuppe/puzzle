<template>
  <div class="imageteaser" :style="style" @click="onClick"></div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'image-teaser',
  props: {
    image: {
      type: Object,
      required: true,
    },
  },
  computed: {
    style (): object {
      const url = this.image.url.replace('uploads/', 'uploads/r/') + '-150x100.webp'
      return {
        'backgroundImage': `url("${url}")`,
      }
    },
  },
  methods: {
    onClick() {
      this.$emit('click')
    },
  },
})
</script>
