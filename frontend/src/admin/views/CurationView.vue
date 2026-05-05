<template>
  <div class="curation-fullscreen">
    <div class="curation-header">
      <span class="text-body-2 text-disabled">Curation — {{ progress.reviewed }} / {{ progress.total }}</span>
      <v-btn
        icon="mdi-close"
        size="small"
        variant="text"
        :to="{ name: 'admin' }"
      />
    </div>

    <div
      v-if="loading"
      class="d-flex justify-center align-center flex-grow-1"
    >
      <v-progress-circular indeterminate />
    </div>

    <div
      v-else-if="!image"
      class="d-flex justify-center align-center flex-grow-1 text-h6"
    >
      🎉 All images have been reviewed!
    </div>

    <template v-else>
      <div class="curation-preview">
        <a
          :href="`/uploads/${image.filename}`"
          target="_blank"
        ><img
          :src="resizeUrl(`/image-service/image/${image.filename}`, 1200, 900, 'contain')"
          class="curation-image"
        ></a>
      </div>

      <div class="curation-footer">
        <div class="curation-info">
          <span>
            <span class="text-disabled">Title:</span>
            <span :class="{ 'text-warning': !image.title }">{{ image.title || '⚠ Missing' }}</span>
          </span>
          <span>
            <span class="text-disabled">Creator:</span>
            <span :class="{ 'text-warning': !image.copyright_name }">{{ image.copyright_name || '⚠ Missing' }}</span>
          </span>
          <span>
            <span class="text-disabled">URL:</span>
            <span :class="{ 'text-warning': !image.copyright_url }">{{ image.copyright_url || '⚠ Missing' }}</span>
          </span>
          <span><span class="text-disabled">{{ image.width }}×{{ image.height }}</span></span>
          <span><span class="text-disabled">State:</span> {{ image.state }}</span>
          <span v-if="image.nsfw">😳 NSFW</span>
          <span v-if="image.ai_generated">🤖 AI</span>
          <span><span class="text-disabled">Uploader:</span> {{ image.uploader_user_name || image.uploader_user_id || '-' }}</span>
          <span><span class="text-disabled">Games:</span> {{ image.games_count }}</span>
        </div>
        <div class="curation-actions">
          <v-btn
            color="success"
            size="large"
            @click="onCurate(ImageState.Curated)"
          >
            ✓ YES
          </v-btn>
          <v-btn
            color="warning"
            size="large"
            @click="onCurate(ImageState.Uncurated)"
          >
            ✗ NO
          </v-btn>
          <v-btn
            color="error"
            size="large"
            @click="onDelete"
          >
            🗑 DELETE
          </v-btn>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ImageState } from '@common/Types'
import type { ImageRowWithCount } from '@common/Types'
import { resizeUrl } from '@common/ImageService'
import api from '../../_api'

const loading = ref(true)
const image = ref<ImageRowWithCount | null>(null)
const progress = ref({ reviewed: 0, total: 0 })

const loadNext = async () => {
  loading.value = true
  const resp = await api.admin.getCurationQueue()
  if ('error' in resp) {
    alert('Failed to load curation queue')
    loading.value = false
    return
  }
  image.value = resp.image
  progress.value = resp.progress
  loading.value = false
}

const onCurate = async (value: ImageState.Curated | ImageState.Uncurated) => {
  if (!image.value) return
  const resp = await api.admin.curateImage(image.value.id, value)
  if ('error' in resp || !resp.ok) {
    alert('Curation failed!')
    return
  }
  await loadNext()
}

const onDelete = async () => {
  if (!image.value) return
  if (!confirm(`Really delete image ${image.value.id}?`)) return
  const resp = await api.admin.deleteImage(image.value.id)
  if ('error' in resp || !resp.ok) {
    alert('Deleting image failed!')
    return
  }
  await loadNext()
}

onMounted(loadNext)
</script>

<style scoped>
.curation-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  background: rgb(var(--v-theme-surface));
}
.curation-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 12px;
}
.curation-preview {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  min-height: 0;
}
.curation-preview a {
  display: block;
  height: 100%;
}
.curation-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
.curation-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 12px;
  flex-wrap: wrap;
}
.curation-info {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 15px;
}
.curation-actions {
  display: flex;
  gap: 8px;
}
</style>
