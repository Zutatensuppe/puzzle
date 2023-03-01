<template>
  <div
    ref="el"
    class="sentinel"
  />
</template>
<script setup lang="ts">
import { onMounted, onUnmounted, Ref, ref } from 'vue'

import { logger } from '../../common/Util'

const log = logger('Sentinel.vue')
log.disable()

const el = ref<HTMLDivElement>() as Ref<HTMLDivElement>

const emit = defineEmits<{
  (e: 'sighted'): void,
}>()

const sighted = () => {
  log.info('sighted')
  emit('sighted')

  // after seeing the element, intersection observer won't trigger again
  // unless the element goes out of view again. so we manually check
  // after a certain amount of time after each sighting
  setTimeout(() => {
    if (isInViewport(el.value)) {
      log.info('viewport check detected intersection')
      sighted()
    }
  }, 1000)
}

const OFFSET = 640
const isInViewport = (element) => {
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

let interval: any = null
let observer = new IntersectionObserver((entries: IntersectionObserverEntry[]) => {
  const intersecting = entries.some(e => e.isIntersecting)
  if (intersecting) {
    log.info('observer detected intersection')
    sighted()
  }
}, {
  rootMargin: `${OFFSET}px`,
  threshold: 1.0,
})
onMounted(() => {
  log.info('start observing')
  observer.observe(el.value)
})
onUnmounted(() => {
  log.info('disconnect')
  observer.disconnect()
  clearInterval(interval)
})
</script>
