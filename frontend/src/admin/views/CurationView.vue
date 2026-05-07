<template>
  <div class="curation-fullscreen">
    <div class="curation-header">
      <div class="curation-controls">
        <v-select
          v-model="topic"
          :items="topicOptions"
          item-title="label"
          item-value="value"
          density="compact"
          variant="outlined"
          hide-details
          style="max-width: 180px"
          @update:model-value="onTopicChange"
        />
        <v-text-field
          v-if="topic === '_custom'"
          v-model="customTag"
          density="compact"
          variant="outlined"
          hide-details
          placeholder="tag slug"
          style="max-width: 140px"
          @keydown.enter="onCustomTagConfirm"
        />
        <v-text-field
          v-model.number="maxPasses"
          type="number"
          density="compact"
          variant="outlined"
          hide-details
          label="Max passes"
          min="0"
          style="max-width: 100px"
          @change="loadNext"
        />
        <span class="text-body-2 text-disabled">{{ progress.reviewed }} / {{ progress.total }}</span>
        <span class="topic-label">{{ topicDisplay }}</span>
      </div>
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
      🎉 All done for this topic!
    </div>

    <template v-else>
      <div class="curation-preview">
        <a
          :href="`/uploads/${image.filename}`"
          target="_blank"
        ><img
          :src="`/uploads/${image.filename}`"
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
          <span>
            <span :class="imageSizeWarning ? 'text-warning' : 'text-disabled'">
              {{ imageSizeWarning ? '⚠ ' : '' }}{{ image.width }}×{{ image.height }}
            </span></span>
          <span><span class="text-disabled">State:</span> {{ image.state }}</span>
          <span v-if="image.nsfw">😳 NSFW</span>
          <span v-if="image.ai_generated">🤖 AI</span>
          <span><span class="text-disabled">Uploader:</span> {{ image.uploader_user_name || image.uploader_user_id || '-' }}</span>
          <span><span class="text-disabled">Games:</span> {{ image.games_count }}</span>
          <span
            v-if="image.tags.length"
            class="curation-tags"
          >
            <v-chip
              v-for="tag in image.tags"
              :key="tag.id"
              size="x-small"
              variant="outlined"
            >
              {{ tag.title }}
            </v-chip>
          </span>
        </div>
        <div class="curation-actions">
          <v-chip
            :color="topicValueColor"
            size="large"
            variant="flat"
            class="topic-value-chip"
          >
            {{ topicValueLabel }}
          </v-chip>
          <v-btn
            color="success"
            size="large"
            @click="onCurate('yes')"
          >
            ✓ YES
          </v-btn>
          <v-btn
            color="warning"
            size="large"
            @click="onCurate('no')"
          >
            ✗ NO
          </v-btn>
        </div>
        <ImageActions
          :image="image"
          @updated="onImageUpdated"
          @deleted="loadNext"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { ImageRowWithCount, TagRow } from '@common/Types'
import { resizeUrl } from '@common/ImageService'
import api from '../../_api'
import ImageActions from '../components/ImageActions.vue'

type CurationImage = ImageRowWithCount & { tags: TagRow[], topic_value: string | number | boolean | null }

const topicOptions = [
  { label: 'Curated State', value: 'state' },
  { label: 'AI Generated', value: 'ai_generated' },
  { label: 'NSFW', value: 'nsfw' },
  { label: 'Custom Tag…', value: '_custom' },
]

const topic = ref('state')
const customTag = ref('')
const maxPasses = ref(0)
const loading = ref(true)
const image = ref<CurationImage | null>(null)
const progress = ref({ reviewed: 0, total: 0 })

const effectiveTopic = computed(() => {
  if (topic.value === '_custom' && customTag.value) {
    return `tag:${customTag.value}`
  }
  return topic.value === '_custom' ? '' : topic.value
})

const imageSizeWarning = computed(() => {
  if (!image.value) return false
  return image.value.width < 1000 || image.value.height < 1000
})

const topicDisplay = computed(() => {
  const t = effectiveTopic.value
  if (t === 'state') return 'Curating for: State'
  if (t === 'ai_generated') return 'Curating for: AI Generated'
  if (t === 'nsfw') return 'Curating for: NSFW'
  if (t.startsWith('tag:')) return `Curating for: TAG "${t.slice(4)}"`
  return ''
})

const topicValueColor = computed(() => {
  const v = image.value?.topic_value
  if (v === null || v === undefined) return 'grey'
  const t = effectiveTopic.value
  if (t === 'state') {
    if (v === 'curated') return 'success'
    if (v === 'uncurated') return 'warning'
    return 'grey'
  }
  // boolean/number topics
  return v ? 'success' : 'grey'
})

const topicValueLabel = computed(() => {
  const v = image.value?.topic_value
  if (v === null || v === undefined) return 'unset'
  const t = effectiveTopic.value
  if (t === 'state') return String(v)
  if (t.startsWith('tag:')) return v ? 'tagged' : 'not tagged'
  return v ? 'yes' : 'no'
})

const loadNext = async () => {
  const t = effectiveTopic.value
  if (!t) return
  loading.value = true
  const resp = await api.admin.getCurationQueue(t, maxPasses.value)
  if ('error' in resp) {
    alert('Failed to load curation queue')
    loading.value = false
    return
  }
  image.value = resp.image as CurationImage | null
  progress.value = resp.progress
  loading.value = false
}

const onTopicChange = () => {
  if (topic.value !== '_custom') {
    void loadNext()
  }
}

const onCustomTagConfirm = () => {
  if (customTag.value) {
    void loadNext()
  }
}

const onCurate = async (decision: 'yes' | 'no') => {
  if (!image.value) return
  const t = effectiveTopic.value
  if (!t) return
  const resp = await api.admin.curateImage(image.value.id, t, decision)
  if ('error' in resp || !resp.ok) {
    alert('Curation failed!')
    return
  }
  await loadNext()
}

const onImageUpdated = (patch: Partial<ImageRowWithCount>) => {
  if (image.value) {
    Object.assign(image.value, patch)
  }
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
  gap: 8px;
}
.curation-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.topic-label {
  font-weight: 600;
  font-size: 14px;
  white-space: nowrap;
}
.topic-value-chip {
  font-size: 16px;
  font-weight: 600;
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
  align-items: center;
}
.curation-tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.curation-actions {
  display: flex;
  gap: 8px;
}
</style>
