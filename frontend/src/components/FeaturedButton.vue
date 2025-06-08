<template>
  <div
    class="featured-button is-clickable"
    :style="style"
  >
    <div class="featured-button-inner">
      <div class="featured-button-type">
        {{ type }}
      </div>
      <div class="featured-button-title">
        <img
          v-if="icon"
          :src="icon"
          width="36"
          height="36"
          style="border-radius:36px;"
          class="mr-3"
        >
        {{ title }}
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import type { FeaturedRowWithCollections } from '../Types'
import { resizeUrl } from '../../../common/src/ImageService'

const props = defineProps<{
  featured: FeaturedRowWithCollections
}>()

const style = computed(() => {
  const firstImage = props.featured.collections[0]?.images[0]
  if (!firstImage) {
    return {}
  }
  const imgResized = resizeUrl(`/image-service/image/${firstImage.filename}`, 375, 0, 'cover')
  return ({
    backgroundImage: `url(${imgResized})`,
  })
})
const type = computed(() => props.featured.type === 'category' ? 'Category' : 'Artist')
const title = computed(() => {
  return props.featured.name
})
const icon = computed(() => {
  if (props.featured.name === 'LisadiKaprio') {
    return '/assets/featured-artist/lisa.png'
  }
  if (props.featured.name === 'PEAKY_kun') {
    return '/assets/featured-artist/peaky.png'
  }
  return null
})
</script>
