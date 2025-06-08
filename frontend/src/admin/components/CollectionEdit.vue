<template>
  <v-card class="pa-3 mb-3">
    <div class="d-flex gc-5">
      <h3>{{ val.name || '<Untitled Collection>' }} (Id: {{ val.id }})</h3>
      <v-btn @click="onDeleteClick">
        Delete
      </v-btn>
    </div>

    <v-text-field
      v-model="val.name"
      label="Name"
      density="compact"
    />

    <strong>Images</strong>
    <div class="d-flex flex-wrap ga-5">
      <div
        v-for="(image, idx) in val.images"
        :key="image.id"
      >
        <div>Id: {{ image.id }}</div>
        <div class="d-flex ga-3">
          <span class="is-clickable" @click="moveImage(idx, -1)">◀</span>
          <span class="is-clickable" @click="moveImage(idx, +1)">▶</span>
        </div>
        <div>
          <a
            :href="`/uploads/${image.filename}`"
            target="_blank"
            class="image-holder"
          ><img
            :src="resizeUrl(`/image-service/image/${image.filename}`, 150, 100, 'contain')"
            :class="image.private ? ['image-private', 'image'] : ['image']"
          ></a>
        </div>
        <v-btn @click="onRemoveImageClick(image.id)">
          Remove
        </v-btn>
      </div>
    </div>

    <h4>Image Search</h4>
    <div>
      <v-text-field
        v-model="search.idCsv"
        label="IDs (Comma separated)"
        density="compact"
      />
      <v-text-field
        v-model="search.tagCsv"
        label="Tags (Comma separated)"
        density="compact"
      />
      <v-btn @click="onSearchClick">
        Search
      </v-btn>
    </div>

    <div v-if="searchResults.length > 0">
      <strong>Search Results</strong>
      <div class="d-flex flex-wrap ga-5">
        <div
          v-for="image in searchResults"
          :key="image.id"
        >
          <img
            :src="resizeUrl(`/image-service/image/${image.filename}`, 150, 100, 'contain')"
          >
          <br>
          <v-btn @click="onAddImageClick(image.id)">
            Add to Collection
          </v-btn>
        </div>
      </div>
    </div>
  </v-card>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue'
import { resizeUrl } from '../../../../common/src/ImageService'
import type { CollectionRowWithImages, ImageId, ImageRowWithCount } from '../../../../common/src/Types'
import api from '../../_api'
import { arrayMove } from '../../../../common/src/Util'

const props = defineProps<{
  modelValue: CollectionRowWithImages
}>()

const val = ref<CollectionRowWithImages>(JSON.parse(JSON.stringify(props.modelValue)))

const emit = defineEmits<{
  (e: 'delete', collection: CollectionRowWithImages): void
  (e: 'update:modelValue', val: CollectionRowWithImages): void
}>()

const search = ref<{
  idCsv: string
  tagCsv: string
}>({
  idCsv: '',
  tagCsv: '',
})

const searchResults = ref<ImageRowWithCount[]>([])

const moveImage = (idx: number, direction: -1 | 1) => {
  val.value.images = arrayMove(val.value.images, idx, direction)
}

const onSearchClick = async () => {
  const ids = search.value.idCsv.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id)) as ImageId[]
  const tags = search.value.tagCsv.split(',').map(tag => tag.trim()).filter(Boolean)

  if (ids.length === 0 && tags.length === 0) {
    console.warn('No IDs or tags provided for search.')
    return
  }

  const res = await api.admin.getImages({ limit: 100, offset: 0, ids, tags })
  if ('error' in res) {
    console.error('Error searching images:', res.error)
    return
  }

  searchResults.value = res.items
}

const onDeleteClick = () => {
  emit('delete', props.modelValue)
}

const onAddImageClick = async (imageId: ImageId) => {
  const res = await api.admin.getImage(imageId)
  if ('error' in res) {
    console.error('Error fetching image:', res.error)
    return
  }
  val.value.images.push(res.image)
}

const onRemoveImageClick = (imageId: ImageId) => {
  val.value.images = val.value.images.filter(image => image.id !== imageId)
}

watch(val.value, () => {
  emit('update:modelValue', val.value)
}, { deep: true })
</script>
