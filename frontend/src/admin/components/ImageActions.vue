<template>
  <div class="image-actions">
    <div class="d-flex ga-1 flex-wrap">
      <v-btn
        size="x-small"
        @click="onTogglePrivate"
      >
        {{ image.private ? 'SET PUBLIC' : 'SET PRIVATE' }}
      </v-btn>
      <v-btn
        size="x-small"
        @click="onToggleNsfw"
      >
        {{ image.nsfw ? 'UNSET NSFW' : 'SET NSFW' }}
      </v-btn>
      <v-btn
        size="x-small"
        @click="onToggleAi"
      >
        {{ image.ai_generated ? 'UNSET AI' : 'SET AI' }}
      </v-btn>
      <v-btn
        v-if="!IMAGE_STATES_TRUSTED.includes(image.state)"
        size="x-small"
        color="success"
        @click="onApprove"
      >
        APPROVE
      </v-btn>
      <v-btn
        v-if="!IMAGE_STATES_REJECTED.includes(image.state)"
        size="x-small"
        color="error"
        @click="onReject"
      >
        REJECT
      </v-btn>
      <v-btn
        size="x-small"
        @click="onDelete"
      >
        DELETE
      </v-btn>
    </div>
    <div
      v-if="tags !== undefined"
      class="d-flex ga-1 align-center flex-wrap mt-1"
    >
      <v-chip
        v-for="tag in tags"
        :key="tag.id"
        size="x-small"
        variant="outlined"
        closable
        @click:close="onRemoveTag(tag)"
      >
        {{ tag.title }}
      </v-chip>
      <v-menu
        v-model="addTagMenuOpen"
        :close-on-content-click="false"
        location="top start"
      >
        <template #activator="{ props: menuProps }">
          <v-btn
            v-bind="menuProps"
            size="x-small"
            variant="tonal"
            prepend-icon="mdi-tag-plus"
          >
            ADD TAG
          </v-btn>
        </template>
        <v-card
          min-width="250"
          max-height="300"
        >
          <v-text-field
            v-model="tagSearch"
            density="compact"
            variant="outlined"
            hide-details
            placeholder="Search or enter slug…"
            autofocus
            class="ma-2"
            @keydown.enter="onCustomTagAdd"
          />
          <v-list
            density="compact"
            class="overflow-y-auto"
            style="max-height: 200px"
          >
            <v-list-item
              v-for="tag in filteredAvailableTags"
              :key="tag.id"
              :class="{ 'text-medium-emphasis': !tag.has_confirmed }"
              @click="onAddTag(tag.slug)"
            >
              <v-list-item-title>
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
            <v-list-item
              v-if="tagSearch.trim() && !filteredAvailableTags.length"
              @click="onCustomTagAdd"
            >
              <v-list-item-title class="text-medium-emphasis">
                Add "{{ tagSearch.trim() }}" as new tag
              </v-list-item-title>
            </v-list-item>
          </v-list>
        </v-card>
      </v-menu>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { IMAGE_STATES_TRUSTED, IMAGE_STATES_REJECTED, ImageState } from '@common/Types'
import type { ImageRowWithCount, TagRow } from '@common/Types'
import api from '../../_api'

type AvailableTag = TagRow & { has_confirmed: boolean, uncurated_count: number }

const props = defineProps<{
  image: ImageRowWithCount
  tags?: TagRow[]
  availableTags?: AvailableTag[]
}>()

const emit = defineEmits<{
  (e: 'updated', patch: Partial<ImageRowWithCount>): void
  (e: 'deleted'): void
  (e: 'tag-added', tag: TagRow): void
  (e: 'tag-removed', tag: TagRow): void
}>()

const addTagMenuOpen = ref(false)
const tagSearch = ref('')

const currentTagSlugs = computed(() => new Set((props.tags ?? []).map((t) => t.slug)))

const filteredAvailableTags = computed(() => {
  const all = props.availableTags ?? []
  const search = tagSearch.value.trim().toLowerCase()
  return all
    .filter((t) => !currentTagSlugs.value.has(t.slug))
    .filter((t) => !search || t.title.toLowerCase().includes(search) || t.slug.toLowerCase().includes(search))
})

const onAddTag = async (slug: string) => {
  const resp = await api.admin.addImageTag(props.image.id, slug)
  if ('error' in resp || !resp.ok) {
    alert('Adding tag failed!')
  } else {
    emit('tag-added', resp.tag)
    tagSearch.value = ''
    addTagMenuOpen.value = false
  }
}

const onCustomTagAdd = async () => {
  const slug = tagSearch.value.trim()
  if (!slug) return
  await onAddTag(slug)
}

const onRemoveTag = async (tag: TagRow) => {
  const resp = await api.admin.removeImageTag(props.image.id, tag.slug)
  if ('error' in resp || !resp.ok) {
    alert('Removing tag failed!')
  } else {
    emit('tag-removed', tag)
  }
}

const onTogglePrivate = async () => {
  const newValue = !props.image.private
  const resp = await api.admin.setImagePrivate(props.image.id, newValue)
  if ('error' in resp || !resp.ok) {
    alert('Toggling private failed!')
  } else {
    emit('updated', { private: newValue ? 1 : 0 })
  }
}

const onToggleNsfw = async () => {
  const newValue = !props.image.nsfw
  const resp = await api.admin.setImageNsfw(props.image.id, newValue)
  if ('error' in resp || !resp.ok) {
    alert('Toggling NSFW failed!')
  } else {
    emit('updated', { nsfw: newValue ? 1 : 0 })
  }
}

const onToggleAi = async () => {
  const newValue = props.image.ai_generated ? 0 : 1
  const resp = await api.admin.setImageAiGenerated(props.image.id, newValue)
  if ('error' in resp || !resp.ok) {
    alert('Toggling AI-generated failed!')
  } else {
    emit('updated', { ai_generated: newValue })
  }
}

const onApprove = async () => {
  const resp = await api.admin.approveImage(props.image.id)
  if ('error' in resp || !resp.ok) {
    alert('Approving image failed!')
  } else {
    emit('updated', { state: ImageState.Approved })
  }
}

const onReject = async () => {
  const reason = prompt('Rejection reason (optional):')
  if (reason === null) {
    return
  }
  const resp = await api.admin.rejectImage(props.image.id, reason)
  if ('error' in resp || !resp.ok) {
    alert('Rejecting image failed!')
  } else {
    emit('updated', { state: ImageState.Rejected })
  }
}

const onDelete = async () => {
  if (!confirm(`Really delete image ${props.image.id}?`)) {
    return
  }
  const resp = await api.admin.deleteImage(props.image.id)
  if ('error' in resp || !resp.ok) {
    alert('Deleting image failed!')
  } else {
    emit('deleted')
  }
}
</script>
