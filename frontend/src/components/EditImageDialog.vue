<template>
  <v-card class="edit-image-dialog">
    <v-card-title>Edit Image</v-card-title>

    <v-container :fluid="true">
      <v-row>
        <v-col :lg="8">
          <div
            class="has-image"
            style="min-height: 50vh;"
          >
            <ResponsiveImage
              :src="image.url"
              :title="image.title"
            />
          </div>
        </v-col>
        <v-col
          :lg="4"
          class="area-settings"
        >
          <div>
            <v-text-field
              v-model="title"
              density="compact"
              placeholder="eg. Flower by @artist"
              label="Title"
            />
          </div>
          <fieldset>
            <legend>Source</legend>
            <v-text-field
              v-model="copyrightName"
              density="compact"
              placeholder="eg. Artist Name"
              label="Creator"
            />
            <v-text-field
              v-model="copyrightURL"
              density="compact"
              placeholder="eg. https://example.net/"
              label="URL"
            />
          </fieldset>
          <fieldset>
            <legend>Tags</legend>
            <TagsInput
              v-model="tags"
              :autocomplete-tags="autocompleteTags"
            />
          </fieldset>

          <v-card-actions>
            <v-btn
              variant="elevated"
              color="success"
              prepend-icon="mdi-image"
              @click="saveImage"
            >
              Save image
            </v-btn>
            <v-btn
              color="error"
              variant="elevated"
              @click="emit('close')"
            >
              Cancel
            </v-btn>
          </v-card-actions>
        </v-col>
      </v-row>
    </v-container>
  </v-card>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue'
import { ImageInfo, SaveImageRequestData, Tag } from '../../../common/src/Types'
import TagsInput from '../components/TagsInput.vue'
import ResponsiveImage from './ResponsiveImage.vue'

const props = defineProps<{
  image: ImageInfo
  autocompleteTags: (input: string, exclude: string[]) => string[]
}>()

const emit = defineEmits<{
  (e: 'saveClick', val: SaveImageRequestData): void
  (e: 'close'): void
}>()

const title = ref<string>('')
const copyrightName = ref<string>('')
const copyrightURL = ref<string>('')
const tags = ref<string[]>([])

const init = (image: ImageInfo) => {
  title.value = image.title
  copyrightName.value = image.copyrightName
  copyrightURL.value = image.copyrightURL
  tags.value = image.tags.map((t: Tag) => t.title)
}

const saveImage = () => {
  emit('saveClick', {
    id: props.image.id,
    title: title.value,
    copyrightName: copyrightName.value,
    copyrightURL: copyrightURL.value,
    tags: tags.value,
  })
}

init(props.image)
watch(() => props.image, (newValue) => {
  init(newValue)
})
</script>
