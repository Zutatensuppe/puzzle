<template>
  <MasonryWall :items="images" :column-width="320" :gap="10">
    <template #default="{ item, index }">
      <ImageTeaser :image="item" @click="emit('imageClicked', item)" @editClick="emit('imageEditClicked', item)" :key="index" />
    </template>
  </MasonryWall>
</template>
<script setup lang="ts">
import { ImageInfo } from '../../common/Types'
import ImageTeaser from './ImageTeaser.vue';
import MasonryWall from './MasonryWall.vue';

defineProps<{
  images: ImageInfo[]
}>()

const emit = defineEmits<{
  (e: 'imageClicked', val: ImageInfo): void
  (e: 'imageEditClicked', val: ImageInfo): void
}>()
</script>
