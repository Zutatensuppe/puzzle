<template>
  <div
    class="avatar-icon"
    :style="avatarStyle"
  />
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { resizeUrl } from '@common/ImageService'

const props = defineProps<{
  avatarUrl: string | null,
  size: number,
}>()

const avatarStyle = computed(() => {
  const imgUrl = props.avatarUrl
  if (!imgUrl) {
    return null
  }

  return {
    backgroundImage: `url(${resizeUrl(imgUrl, props.size * 2, props.size * 2, 'cover')})`,
    width: `${props.size}px`,
    height: `${props.size}px`,
  }
})
</script>
