<template>
  <div>
    <a
      :href="`/uploads/${image.filename}`"
      target="_blank"
      class="image-holder"
    ><img
      :src="resizeUrl(`/image-service/image/${image.filename}`, 150, 100, 'contain')"
      :class="image.private ? ['image-private', 'image'] : ['image']"
    ></a>
    <br>
    <v-btn @click="emit('remove')">
      Remove
    </v-btn>
  </div>
</template>
<script setup lang="ts">
import { resizeUrl } from '../../../../common/src/ImageService'
import { ImageInfo } from '../../../../common/src/Types'

defineProps<{
  image: ImageInfo
}>()

const emit = defineEmits<{
  (e: 'remove'): void
}>()
</script>
