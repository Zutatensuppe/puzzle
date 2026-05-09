<template>
  <div class="curation-fullscreen">
    <div class="curation-header">
      <div class="curation-controls">
        <div class="control-group">
          <span class="control-group-label">Curate</span>
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
          <v-combobox
            v-if="topic === 'tag'"
            v-model="selectedTagSlug"
            :items="availableTags"
            item-value="slug"
            density="compact"
            variant="outlined"
            hide-details
            placeholder="Tag"
            persistent-placeholder
            style="max-width: 200px"
            :custom-filter="tagAutoCompleteFilter"
            @update:model-value="onTagComboSelect"
          >
            <template #selection="{ item }">
              {{ typeof item.value === 'string' ? item.value : item.raw.title }}
            </template>
            <template #prepend-inner>
              <span
                v-if="!selectedTagSlug"
                class="text-medium-emphasis"
              >Tag</span>
            </template>
            <template #item="{ item, props: itemProps }">
              <v-list-item
                v-bind="itemProps"
              >
                <v-list-item-title :class="{ 'text-medium-emphasis': !item.raw.has_confirmed }">
                  <span class="text-disabled text-caption mr-1">#{{ item.raw.id }}</span>
                  {{ item.raw.title }}
                  <v-icon
                    v-if="item.raw.has_confirmed"
                    size="x-small"
                    color="success"
                    class="ml-1"
                  >
                    mdi-check-decagram
                  </v-icon>
                  <span
                    v-if="item.raw.uncurated_count"
                    class="text-caption ml-1"
                    :class="item.raw.uncurated_count ? 'text-warning' : 'text-disabled'"
                  >({{ item.raw.uncurated_count }})</span>
                </v-list-item-title>
              </v-list-item>
            </template>
          </v-combobox>
          <span class="text-body-2 text-disabled">{{ progress.reviewed }} / {{ progress.total }}</span>
        </div>
        <v-divider
          vertical
          class="mx-1 control-divider"
        />
        <div class="control-group">
          <span class="control-group-label">Filter</span>
          <v-select
            v-model="maxPasses"
            :items="maxPassesOptions"
            item-title="label"
            item-value="value"
            density="compact"
            variant="outlined"
            hide-details
            style="max-width: 160px"
            @update:model-value="loadNext"
          />
          <v-chip
            size="small"
            :variant="filterState ? 'flat' : 'outlined'"
            :color="filterState === 'curated' ? 'success' : filterState === 'uncurated' ? 'warning' : undefined"
            class="filter-chip"
            @click="cycleFilter('state')"
          >
            State: {{ filterState || 'any' }}
          </v-chip>
          <v-chip
            size="small"
            :variant="filterNsfw ? 'flat' : 'outlined'"
            :color="filterNsfw === 'yes' ? 'error' : filterNsfw === 'no' ? 'success' : undefined"
            class="filter-chip"
            @click="cycleFilter('nsfw')"
          >
            NSFW: {{ filterNsfw || 'any' }}
          </v-chip>
          <v-chip
            size="small"
            :variant="filterAiGenerated ? 'flat' : 'outlined'"
            :color="filterAiGenerated === 'yes' ? 'warning' : filterAiGenerated === 'no' ? 'success' : undefined"
            class="filter-chip"
            @click="cycleFilter('ai')"
          >
            AI: {{ filterAiGenerated || 'any' }}
          </v-chip>
          <v-menu
            v-model="tagMenuOpen"
            :close-on-content-click="false"
            location="bottom start"
          >
            <template #activator="{ props: menuProps }">
              <v-select
                v-bind="menuProps"
                :model-value="null"
                :items="[]"
                density="compact"
                variant="outlined"
                hide-details
                readonly
                style="max-width: 160px"
              >
                <template #prepend-inner>
                  <span class="text-medium-emphasis text-no-wrap">{{ activeTagFilterCount ? `Tags (${activeTagFilterCount})` : 'Tags' }}</span>
                </template>
              </v-select>
            </template>
            <v-card>
              <v-text-field
                v-model="filterTagSearch"
                density="compact"
                variant="outlined"
                hide-details
                placeholder="Search tags…"
                autofocus
                class="ma-2"
              />
              <v-list
                density="compact"
                class="tag-filter-list overflow-y-auto"
                style="max-height: 300px"
              >
                <v-list-item
                  v-for="tag in filteredFilterTags"
                  :key="tag.slug"
                  class="tag-filter-item"
                >
                  <template #prepend>
                    <v-btn
                      icon
                      size="x-small"
                      variant="text"
                      :color="tagFilterState(tag.slug) === 'include' ? 'success' : undefined"
                      @click="setTagFilter(tag.slug, 'include')"
                    >
                      <v-icon size="small">
                        mdi-plus-circle{{ tagFilterState(tag.slug) === 'include' ? '' : '-outline' }}
                      </v-icon>
                    </v-btn>
                    <v-btn
                      icon
                      size="x-small"
                      variant="text"
                      :color="tagFilterState(tag.slug) === 'exclude' ? 'error' : undefined"
                      @click="setTagFilter(tag.slug, 'exclude')"
                    >
                      <v-icon size="small">
                        mdi-minus-circle{{ tagFilterState(tag.slug) === 'exclude' ? '' : '-outline' }}
                      </v-icon>
                    </v-btn>
                  </template>
                  <v-list-item-title :class="{ 'text-medium-emphasis': !tag.has_confirmed }">
                    <span class="text-disabled text-caption mr-1">#{{ tag.id }}</span>
                    {{ tag.title }}
                    <v-icon
                      v-if="tag.has_confirmed"
                      size="x-small"
                      color="success"
                      class="ml-1"
                    >
                      mdi-check-decagram
                    </v-icon>
                    <span
                      v-if="tag.uncurated_count"
                      class="text-caption ml-1 text-warning"
                    >({{ tag.uncurated_count }})</span>
                  </v-list-item-title>
                </v-list-item>
              </v-list>
            </v-card>
          </v-menu>
          <v-chip
            v-for="tag in includedTags"
            :key="'inc-' + tag.slug"
            size="x-small"
            color="success"
            variant="flat"
            closable
            @click:close="setTagFilter(tag.slug, 'include')"
          >
            ✓ {{ tag.title }}
          </v-chip>
          <v-chip
            v-for="tag in excludedTags"
            :key="'exc-' + tag.slug"
            size="x-small"
            color="error"
            variant="flat"
            closable
            @click:close="setTagFilter(tag.slug, 'exclude')"
          >
            ✗ {{ tag.title }}
          </v-chip>
        </div>
      </div>
      <div
        v-if="image"
        class="curation-actions"
      >
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
        <ImageActions
          :image="image"
          :tags="image.tags"
          :available-tags="availableTags"
          @updated="onImageUpdated"
          @deleted="loadNext"
          @tag-added="onTagAdded"
          @tag-removed="onTagRemoved"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, reactive } from 'vue'
import type { ImageRowWithCount, TagRow } from '@common/Types'
import api from '../../_api'
import type { CurationFilters } from '../../_api/admin'
import ImageActions from '../components/ImageActions.vue'

type CurationImage = ImageRowWithCount & { tags: TagRow[], topic_value: string | number | boolean | null }
type AvailableTag = TagRow & { has_confirmed: boolean, uncurated_count: number }

const topicOptions = [
  { label: 'Curated State', value: 'state' },
  { label: 'AI Generated', value: 'ai_generated' },
  { label: 'NSFW', value: 'nsfw' },
  { label: 'Tag', value: 'tag' },
]

const maxPassesOptions = [
  { label: 'Passes: any', value: -1 },
  { label: 'Passes: 0', value: 0 },
  { label: 'Passes: 1', value: 1 },
  { label: 'Passes: 2', value: 2 },
  { label: 'Passes: 3', value: 3 },
  { label: 'Passes: 5', value: 5 },
  { label: 'Passes: 10', value: 10 },
]

const topic = ref('state')
const selectedTagSlug = ref('')
const maxPasses = ref(0)
const loading = ref(true)
const image = ref<CurationImage | null>(null)
const progress = ref({ reviewed: 0, total: 0 })

const filterState = ref('')
const filterNsfw = ref('')
const filterAiGenerated = ref('')

const stateFilterCycle = ['', 'curated', 'uncurated'] as const
const boolFilterCycle = ['', 'yes', 'no'] as const

const cycleFilter = (filter: 'state' | 'nsfw' | 'ai') => {
  if (filter === 'state') {
    const idx = stateFilterCycle.indexOf(filterState.value as typeof stateFilterCycle[number])
    filterState.value = stateFilterCycle[(idx + 1) % stateFilterCycle.length]
  } else if (filter === 'nsfw') {
    const idx = boolFilterCycle.indexOf(filterNsfw.value as typeof boolFilterCycle[number])
    filterNsfw.value = boolFilterCycle[(idx + 1) % boolFilterCycle.length]
  } else {
    const idx = boolFilterCycle.indexOf(filterAiGenerated.value as typeof boolFilterCycle[number])
    filterAiGenerated.value = boolFilterCycle[(idx + 1) % boolFilterCycle.length]
  }
  void loadNext()
}

const availableTags = ref<AvailableTag[]>([])
const tagMenuOpen = ref(false)
const filterTagSearch = ref('')

const tagAutoCompleteFilter = (_value: string, queryText: string, item?: { raw: AvailableTag }) => {
  if (!item) return false
  const q = queryText.toLowerCase()
  return item.raw.title.toLowerCase().includes(q) || item.raw.slug.toLowerCase().includes(q)
}

const filteredFilterTags = computed(() => {
  const search = filterTagSearch.value.trim().toLowerCase()
  if (!search) return availableTags.value
  return availableTags.value.filter((t) =>
    t.title.toLowerCase().includes(search) || t.slug.toLowerCase().includes(search),
  )
})

// '' = neutral, 'include', 'exclude'
const tagFilters = reactive<Record<string, '' | 'include' | 'exclude'>>({})

const tagFilterState = (slug: string): '' | 'include' | 'exclude' => tagFilters[slug] ?? ''

const activeTagFilterCount = computed(() =>
  Object.values(tagFilters).filter((v) => v !== '').length,
)

const includedTags = computed(() =>
  availableTags.value.filter((t) => tagFilters[t.slug] === 'include'),
)

const excludedTags = computed(() =>
  availableTags.value.filter((t) => tagFilters[t.slug] === 'exclude'),
)

const setTagFilter = (slug: string, action: 'include' | 'exclude') => {
  tagFilters[slug] = tagFilterState(slug) === action ? '' : action
  void loadNext()
}

const currentFilters = computed<CurationFilters>((): CurationFilters => {
  const requireTags: string[] = []
  const excludeTags: string[] = []
  for (const [slug, state] of Object.entries(tagFilters)) {
    if (state === 'include') {
      requireTags.push(slug)
    } else if (state === 'exclude') {
      excludeTags.push(slug)
    }
  }
  return {
    state: filterState.value || undefined,
    nsfw: filterNsfw.value || undefined,
    aiGenerated: filterAiGenerated.value || undefined,
    requireTags,
    excludeTags,
  }
})

const effectiveTopic = computed(() => {
  if (topic.value === 'tag' && selectedTagSlug.value) {
    return `tag:${selectedTagSlug.value}`
  }
  return topic.value
})

const imageSizeWarning = computed(() => {
  if (!image.value) return false
  return image.value.width < 1000 || image.value.height < 1000
})

const topicValueColor = computed(() => 'grey')

const topicValueLabel = computed(() => {
  const t = effectiveTopic.value
  const v = image.value?.topic_value
  const valueStr = v === null || v === undefined ? 'unset'
    : t === 'state' ? String(v === 'curated' ? 'Yes' : 'No')
    : t.startsWith('tag:') ? (v ? 'tagged' : 'not tagged')
    : (v ? 'yes' : 'no')
  const topicStr = t === 'state' ? 'Curated'
    : t === 'ai_generated' ? 'AI Generated'
    : t === 'nsfw' ? 'NSFW'
    : t.startsWith('tag:') ? `Tag: ${t.slice(4)}`
    : ''
  return `${topicStr}: ${valueStr}`
})

const loadNext = async () => {
  const t = effectiveTopic.value
  if (!t) return
  loading.value = true
  const resp = await api.admin.getCurationQueue(t, maxPasses.value, currentFilters.value)
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
  if (topic.value !== 'tag') {
    void loadNext()
  }
}

const onTagComboSelect = (val: unknown) => {
  if (typeof val === 'object' && val !== null && 'slug' in val) {
    selectedTagSlug.value = (val as AvailableTag).slug
  } else if (typeof val === 'string') {
    selectedTagSlug.value = val
  }
  if (selectedTagSlug.value) {
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

const onTagAdded = (tag: TagRow) => {
  if (image.value && !image.value.tags.some((t) => t.id === tag.id)) {
    image.value.tags.push(tag)
  }
}

const onTagRemoved = (tag: TagRow) => {
  if (image.value) {
    image.value.tags = image.value.tags.filter((t) => t.id !== tag.id)
  }
}

const loadTags = async () => {
  const resp = await api.admin.getConfirmedTags()
  if (!('error' in resp)) {
    availableTags.value = resp
  }
}

onMounted(async () => {
  await Promise.all([loadTags(), loadNext()])
})
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
.control-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.control-group-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  opacity: 0.5;
  white-space: nowrap;
}
.control-divider {
  align-self: stretch;
  min-height: 28px;
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
.filter-chip {
  cursor: pointer;
}
.tag-filter-list {
  max-height: 400px;
  overflow-y: auto;
}
.tag-filter-item :deep(.v-list-item__prepend) {
  gap: 0;
}
</style>
