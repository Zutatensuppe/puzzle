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
      <CollectionEditImage
        v-for="image in val.images"
        :key="image.id"
        :image="image"
        @remove="onRemoveImageClick(image.id)"
      />
    </div>

    <div class="d-flex">
      <v-text-field
        v-model="imageIdToAdd"
        label="Image Id"
        density="compact"
      />
      <v-btn @click="onAddImageClick">
        Add Image
      </v-btn>
    </div>
  </v-card>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue'
import { CollectionRowWithImages, ImageId } from '../../../../common/src/Types'
import api from '../../_api'
import CollectionEditImage from './CollectionEditImage.vue'

const props = defineProps<{
  modelValue: CollectionRowWithImages
}>()

const val = ref<CollectionRowWithImages>(JSON.parse(JSON.stringify(props.modelValue)))

const emit = defineEmits<{
  (e: 'delete', collection: CollectionRowWithImages): void
  (e: 'update:modelValue', val: CollectionRowWithImages): void
}>()

const imageIdToAdd = ref<string>('')

const onDeleteClick = () => {
  emit('delete', props.modelValue)
}

const onAddImageClick = async () => {
  const imageId = parseInt(imageIdToAdd.value) as ImageId
  const res = await api.admin.getImage(imageId)
  val.value.images.push(res.image)
}

const onRemoveImageClick = (imageId: ImageId) => {
  val.value.images = val.value.images.filter(image => image.id !== imageId)
}

watch(val.value, () => {
  emit('update:modelValue', val.value)
}, { deep: true })
</script>
