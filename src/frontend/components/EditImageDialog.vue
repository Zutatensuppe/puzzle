<template>
  <v-card class="edit-image-dialog">
    <v-card-title>Edit Image</v-card-title>

    <v-container :fluid="true">
      <v-row no-gutters>
        <v-col :lg="8">
          <div class="has-image" style="min-height: 50vh;">
            <ResponsiveImage :src="image.url" :title="image.title" />
          </div>
        </v-col>
        <v-col :lg="4" class="area-settings">
          <table>
            <tr>
              <td>
                <v-text-field density="compact" v-model="title" placeholder="eg. Flower by @artist" label="Title" />
                <div class="text-disabled">Feel free to leave a credit to the artist/photographer in the title :)</div>
              </td>
            </tr>
            <tr>
              <td>
                <TagsInput v-model="tags" :autocompleteTags="autocompleteTags" />
              </td>
            </tr>
          </table>
        </v-col>
      </v-row>
    </v-container>

    <v-card-actions>
      <v-btn
        variant="elevated"
        @click="saveImage"
        prepend-icon="mdi-image"
      >Save image</v-btn>
      <v-btn
        variant="elevated"
        @click="emit('close')"
      >Cancel</v-btn>
    </v-card-actions>
  </v-card>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue'
import { ImageInfo, Tag } from '../../common/Types'
import TagsInput from '../components/TagsInput.vue'
import ResponsiveImage from './ResponsiveImage.vue'

const props = defineProps<{
  image: ImageInfo
  autocompleteTags: (input: string, exclude: string[]) => string[]
}>()

const emit = defineEmits<{
  (e: 'saveClick', val: { id: number, title: string, tags: string[] }): void
  (e: 'close'): void
}>()

const title = ref<string>('')
const tags = ref<string[]>([])

const init = (image: ImageInfo) => {
  title.value = image.title
  tags.value = image.tags.map((t: Tag) => t.title)
}

const saveImage = () => {
  emit('saveClick', {
    id: props.image.id,
    title: title.value,
    tags: tags.value,
  })
}

init(props.image)
watch(() => props.image, (newValue) => {
  init(newValue)
})
</script>
