<template>
  <v-card
    v-if="editImageImage"
    class="edit-image-dialog-card"
  >
    <v-card-title>Edit Image</v-card-title>

    <v-container :fluid="true">
      <v-row>
        <v-col :lg="8">
          <div
            class="has-image"
            style="min-height: 50vh;"
          >
            <ResponsiveImage
              :src="editImageImage.url"
              :title="editImageImage.title"
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
              v-if="editImageAutocompleteTags"
              v-model="tags"
              :autocomplete-tags="editImageAutocompleteTags"
            />
          </fieldset>
          <div>
            <v-checkbox
              v-model="isPublic"
              :disabled="isNsfw"
              density="comfortable"
              label="Public Image (The image will be visible in the gallery for other users to use.)"
            />
          </div>
          <div>
            <v-checkbox
              v-model="isNsfw"
              density="comfortable"
              label="NSFW Image (Check this if the image is not safe for work. NSFW images will be private automatically.)"
            />
          </div>

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
              @click="closeDialog()"
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
import { computed, ref, watch } from 'vue'
import type { ImageInfo, Tag } from '@common/Types'
import TagsInput from '../TagsInput.vue'
import ResponsiveImage from '../ResponsiveImage.vue'
import { useDialog } from '../../useDialog'

const { closeDialog, editImageImage, editImageAutocompleteTags, editOnSaveImageClick } = useDialog()

const title = ref<string>('')
const copyrightName = ref<string>('')
const copyrightURL = ref<string>('')
const tags = ref<string[]>([])
const isPublic = ref<boolean>(false)
const isNsfw = ref<boolean>(false)

const isPrivate = computed((): boolean => {
  return !isPublic.value || isNsfw.value
})

const init = (image: ImageInfo | undefined) => {
  if (!image) return

  title.value = image.title
  copyrightName.value = image.copyrightName
  copyrightURL.value = image.copyrightURL
  tags.value = image.tags.map((t: Tag) => t.title)
  isPublic.value = !image.private && !image.nsfw
  isNsfw.value = image.nsfw
}

const saveImage = async () => {
  if (!editImageImage.value || !editOnSaveImageClick.value) return

  await editOnSaveImageClick.value({
    id: editImageImage.value.id,
    title: title.value,
    copyrightName: copyrightName.value,
    copyrightURL: copyrightURL.value,
    tags: tags.value,
    isPrivate: isPrivate.value,
    isNsfw: isNsfw.value,
  })
}

init(editImageImage.value)
watch(() => editImageImage.value, (newValue) => {
  init(newValue)
})
</script>
