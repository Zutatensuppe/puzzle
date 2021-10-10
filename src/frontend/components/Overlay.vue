<template>
  <div class="overlay" @click="$emit('bgclick')">
    <slot />
  </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  emits: {
    bgclick: null,
    close: null,
  },
  methods: {
    onKeyUp(ev: KeyboardEvent) {
      if (ev.code === 'Escape' && window.getComputedStyle(this.$el).display !== 'none') {
        this.$emit('close')
      }
    },
  },
  mounted () {
    window.addEventListener('keyup', this.onKeyUp)
  },
  unmounted () {
    window.removeEventListener('keyup', this.onKeyUp)
  },
})
</script>
