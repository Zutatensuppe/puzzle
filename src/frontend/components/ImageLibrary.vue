<template>
  <masonry-wall :items="images" :column-width="320" :gap="10">
    <template #default="{ item, index }">
      <image-teaser :image="item" @click="emit('imageClicked', item)" @editClick="emit('imageEditClicked', item)" :key="index" />
    </template>
  </masonry-wall>
</template>
<script setup lang="ts">
import { ImageInfo } from '../../common/Types'

defineProps<{
  images: ImageInfo[]
}>()

const emit = defineEmits<{
  (e: 'imageClicked', val: ImageInfo): void
  (e: 'imageEditClicked', val: ImageInfo): void
}>()
</script>
