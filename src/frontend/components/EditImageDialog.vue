<template>
  <overlay class="edit-image-dialog" @close="emit('close')">
    <template v-slot:default>
      <div class="area-image">
        <div class="has-image">
          <responsive-image :src="image.url" :title="image.title" />
        </div>
      </div>

      <div class="area-settings">
        <table>
          <tr>
            <td><label>Title</label></td>
            <td><input type="text" v-model="title" placeholder="Flower by @artist" /></td>
          </tr>
          <tr>
            <td colspan="2">
              <div class="hint">Feel free to leave a credit to the artist/photographer in the title :)</div>
            </td>
          </tr>
          <tr>
            <td><label>Tags</label></td>
            <td>
              <tags-input v-model="tags" :autocompleteTags="autocompleteTags" />
            </td>
          </tr>
        </table>
      </div>

      <div class="area-buttons">
        <button class="btn" @click="saveImage"><icon icon="preview" /> Save image</button>
        <button class="btn" @click="emit('close')">Cancel</button>
      </div>
    </template>
  </overlay>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue'
import { Image, ImageInfo, Tag } from '../../common/Types'

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
