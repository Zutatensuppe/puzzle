<template>
  <transition name="overlay"
    :duration="animate ? { enter: 300, leave: 250 } : 0"
    @before-enter="classes=['enter-from']"
    @enter="classes=['enter-active']"
    @after-enter="classes=[]"
    @before-leave="classes=['leave-to', 'leave-active']"
  >
    <div class="overlay">
      <div
        class="overlay-background"
        @click="$emit('bgclick')"
        :class="classes.map(c => 'overlay-background-' + c)">
      </div>
      <div
        class="overlay-content"
        :class="classes.map(c => 'overlay-content-' + c)">
        <slot />
      </div>
    </div>
  </transition>
</template>
<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  props: {
    animate: {
      type: Boolean,
      default: true,
    },
  },
  emits: {
    bgclick: null,
    close: null,
  },
  data: () => ({
    classes: [],
  }),
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
