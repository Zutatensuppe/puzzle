<template>
  <tr>
    <th>
      <a
        :href="`/uploads/${image.filename}`"
        target="_blank"
        class="image-holder"
      ><img
        :src="resizeUrl(`/image-service/image/${image.filename}`, 150, 100, 'contain')"
        :class="image.private ? ['image-private', 'image'] : ['image']"
      ></a>
    </th>
    <td>
      <div class="d-flex ga-3">
        <span class="text-disabled">Title:</span> {{ image.title || '-' }}
        <span class="text-disabled">Dimensions:</span> {{ image.width }}×{{ image.height }}
        <span class="text-disabled">Private:</span> <span :class="{ 'color-private': image.private }">{{ image.private ? '✓' : '✖' }}</span>
      </div>
      <div class="d-flex ga-3">
        <span class="text-disabled">Id:</span> {{ image.id }}
        <span class="text-disabled">Uploader:</span> {{ image.uploader_user_id || '-' }}
        <span class="text-disabled">Created:</span> {{ image.created }}
      </div>
      <div class="d-flex ga-3">
        <span class="text-disabled">Filename:</span> {{ image.filename || '-' }}
      </div>
      <div class="d-flex ga-3">
        <span class="text-disabled">Original Filename:</span> {{ image.filename_original || '-' }}
      </div>
      <div class="d-flex ga-3">
        <span class="text-disabled">Copyright-Name:</span> {{ image.copyright_name || '-' }}
        <span class="text-disabled">Copyright-URL:</span> {{ image.copyright_url || '-' }}
      </div>
    </td>
    <td>{{ image.games_count }}</td>
    <td>
      <span
        class="is-clickable"
        @click="emit('delete', image)"
      >DELETE</span>
    </td>
  </tr>
</template>
<script setup lang="ts">
import { ImageRowWithCount } from '../../../../common/src/Types'
import { resizeUrl } from '../../../../common/src/ImageService'

defineProps<{
  image: ImageRowWithCount
}>()

const emit = defineEmits<{
  (e: 'delete', image: ImageRowWithCount): void
}>()
</script>
