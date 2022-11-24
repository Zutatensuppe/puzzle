<template>
  <div class="overlay" ref="el">
    <div class="overlay-background" @click="emit('bgclick')"></div>
    <div class="overlay-content">
      <slot />
    </div>
  </div>
</template>
<script setup lang="ts">
import { onMounted, onUnmounted, Ref, ref } from 'vue'

const emit = defineEmits<{
  (e: 'bgclick'): void
  (e: 'close'): void
}>()

const el = ref<HTMLDivElement>() as Ref<HTMLDivElement>

const onKeyUp = (ev: KeyboardEvent) => {
  if (ev.code === 'Escape' && window.getComputedStyle(el.value).display !== 'none') {
    emit('close')
  }
}

onMounted(() => {
  window.addEventListener('keyup', onKeyUp)
})

onUnmounted(() => {
  window.removeEventListener('keyup', onKeyUp)
})
</script>
