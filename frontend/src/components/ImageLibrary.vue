<template>
  <MasonryWall
    :items="images"
    :column-width="320"
    :gap="10"
  >
    <template #default="{ item, index }">
      <ImageTeaser
        :key="index"
        :image="item"
        :edit="edit"
        @click="emit('imageClicked', item)"
        @edit-click="emit('imageEditClicked', item)"
      />
    </template>
  </MasonryWall>
</template>
<script setup lang="ts">
import type { ImageInfo } from '../../../common/src/Types'
import ImageTeaser from './ImageTeaser.vue'
import MasonryWall from './MasonryWall.vue'

withDefaults(defineProps<{
  images: ImageInfo[]
  edit?: boolean
}>(), {
  edit: true,
})

const emit = defineEmits<{
  (e: 'imageClicked', val: ImageInfo): void
  (e: 'imageEditClicked', val: ImageInfo): void
}>()
</script>
