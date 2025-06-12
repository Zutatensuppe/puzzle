<template>
  <div
    ref="el"
    class="sentinel"
  />
</template>
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import type { Ref } from 'vue'

const el = ref<HTMLDivElement>() as Ref<HTMLDivElement>

const emit = defineEmits<{
  (e: 'sighted'): void,
}>()

const sighted = () => {
  emit('sighted')

  // after seeing the element, intersection observer won't trigger again
  // unless the element goes out of view again. so we manually check
  // after a certain amount of time after each sighting
  setTimeout(() => {
    if (isInViewport(el.value)) {
      sighted()
    }
  }, 1000)
}

const OFFSET = 640
const isInViewport = (element: HTMLDivElement) => {
  if (!element) {
    return false
  }
  const rect = element.getBoundingClientRect()
  return (
    (rect.top + OFFSET) >= 0 &&
    (rect.left + OFFSET) >= 0 &&
    (rect.bottom - OFFSET) <= (window.innerHeight || document.documentElement.clientHeight) &&
    (rect.right - OFFSET) <= (window.innerWidth || document.documentElement.clientWidth)
  )
}

let observer = new IntersectionObserver((entries: IntersectionObserverEntry[]) => {
  const intersecting = entries.some(e => e.isIntersecting)
  if (intersecting) {
    sighted()
  }
}, {
  rootMargin: `${OFFSET}px`,
  threshold: 1.0,
})
onMounted(() => {
  observer.observe(el.value)
})
onUnmounted(() => {
  observer.disconnect()
})
</script>
