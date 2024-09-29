<template>
  <v-card class="new-image-dialog">
    <v-card-title>New Image</v-card-title>

    <v-container :fluid="true">
      <v-row>
        <v-col
          :lg="8"
          :class="{'no-image': !previewUrl, droppable: droppable}"
          style="min-height: 50vh;"
          @drop="onDrop"
          @dragover="onDragover"
          @dragleave="onDragleave"
        >
          <div class="drop-target" />
          <div
            v-if="previewUrl"
            class="has-image"
            style="min-height: 50vh;"
          >
            <v-btn
              variant="elevated"
              icon="mdi-close"
              size="x-small"
              @click="previewUrl=''"
            />
            <ResponsiveImage :src="previewUrl" />
          </div>
          <div v-else>
            <label class="upload">
              <input
                type="file"
                style="display: none"
                accept="image/*"
                @change="onFileSelect"
              >
              <div class="upload-content">
                To upload an image, choose one of the following methods:
                <ul>
                  <li>Click this area to select an image for upload </li>
                  <li>Drag and drop an image into the area</li>
                  <li>Paste an image URL</li>
                  <li>Paste an image</li>
                </ul>
                <div class="text-disabled">
                  Don't worry, the image will not show up in the gallery
                  unless "Post to gallery" was clicked.
                </div>
              </div>
            </label>
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
              placeholder="eg. Girl with flowers"
              label="Title"
              @focus="inputFocused = true"
              @blur="inputFocused=false"
            />
          </div>
          <fieldset>
            <legend>Source</legend>
            <v-text-field
              v-model="copyrightName"
              density="compact"
              placeholder="eg. Artist Name"
              label="Creator"
              @focus="inputFocused = true"
              @blur="inputFocused=false"
            />
            <v-text-field
              v-model="copyrightURL"
              density="compact"
              placeholder="eg. https://example.net/"
              label="URL"
              @focus="inputFocused = true"
              @blur="inputFocused=false"
            />
          </fieldset>
          <fieldset>
            <legend>Tags</legend>
            <TagsInput
              v-model="tags"
              :autocomplete-tags="autocompleteTags"
            />
          </fieldset>
          <div>
            <v-checkbox
              v-model="isPrivate"
              density="comfortable"
              label="Private Image (Private images won't show up in the public gallery)"
            />
          </div>

          <v-card-actions>
            <!-- isPrivate -->
            <template v-if="isPrivate">
              <v-btn
                v-if="uploading"
                variant="elevated"
                :disabled="true"
                prepend-icon="mdi-timer-sand-empty"
                color="success"
              >
                Uploading ({{ uploadProgressPercent }}%)
              </v-btn>
              <v-btn
                v-else
                variant="elevated"
                :disabled="!canClick"
                prepend-icon="mdi-puzzle"
                color="success"
                @click="setupGameClick"
              >
                Set up game
              </v-btn>
            </template>

            <!-- not isPrivate -->
            <template v-else>
              <v-btn
                v-if="uploading === 'postToGallery'"
                variant="elevated"
                :disabled="true"
                prepend-icon="mdi-timer-sand-empty"
                color="success"
              >
                Uploading ({{ uploadProgressPercent }}%)
              </v-btn>
              <v-btn
                v-else
                variant="elevated"
                :disabled="!canClick"
                prepend-icon="mdi-image"
                color="success"
                @click="postToGallery"
              >
                Post to gallery
              </v-btn>

              <v-btn
                v-if="uploading === 'setupGame'"
                variant="elevated"
                :disabled="true"
                prepend-icon="mdi-timer-sand-empty"
                color="success"
              >
                Uploading ({{ uploadProgressPercent }}%)
              </v-btn>
              <v-btn
                v-else
                variant="elevated"
                :disabled="!canClick"
                prepend-icon="mdi-puzzle"
                color="success"
                @click="setupGameClick"
              >
                Post to gallery <br> + set up game
              </v-btn>
            </template>

            <v-btn
              variant="elevated"
              color="error"
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
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { FrontendGameSettings as FrontendNewImageEventData } from '../../../common/src/Types'
import { logger } from '../../../common/src/Util'
import TagsInput from '../components/TagsInput.vue'
import ResponsiveImage from './ResponsiveImage.vue'
import { toast } from '../toast'
import { Graphics } from '../Graphics'

const log = logger('NewImageDialog.vue')

const gfx = Graphics.getInstance()

const props = defineProps<{
  autocompleteTags: (input: string, exclude: string[]) => string[]
  uploadProgress: number
  uploading: '' | 'postToGallery' | 'setupGame'
}>()

const emit = defineEmits<{
  (e: 'setupGameClick', val: FrontendNewImageEventData): void
  (e: 'postToGalleryClick', val: FrontendNewImageEventData): void
  (e: 'close'): void
}>()

const previewUrl = ref<string>('')
const file = ref<File|null>(null)
const title = ref<string>('')
const copyrightName = ref<string>('')
const copyrightURL = ref<string>('')
const tags = ref<string[]>([])
const isPrivate = ref<boolean>(false)
const droppable = ref<boolean>(false)
const inputFocused = ref<boolean>(false)

const uploadProgressPercent = computed((): number => {
  return props.uploadProgress ? Math.round(props.uploadProgress * 100) : 0
})

const canClick = computed((): boolean => {
  if (props.uploading) {
    return false
  }
  return !!(previewUrl.value && file.value)
})

const reset = (): void => {
  previewUrl.value = ''
  file.value = null
  title.value = ''
  copyrightName.value = ''
  copyrightURL.value = ''
  tags.value = []
  isPrivate.value = false
  droppable.value = false
}

const imageFromDragEvt = (evt: DragEvent): DataTransferItem|null => {
  const items = evt.dataTransfer?.items
  if (!items || items.length === 0) {
    return null
  }
  const item = items[0]
  if (!item.type.startsWith('image/')) {
    return null
  }
  return item
}

const onPaste = async (evt: ClipboardEvent): Promise<void> => {
  if (!evt.clipboardData) {
    return
  }
  // check if a url was pasted
  const imageUrl = evt.clipboardData.getData('text')
  if (imageUrl) {
    if (inputFocused.value) {
      return
    }

    if (imageUrl.match(/^https?:\/\//)) {
      // need to proxy because of X-Origin
      const proxiedUrl = `/api/proxy?${new URLSearchParams({ url: imageUrl })}`
      try {
        const imgBlob = await gfx.loadImageToBlob(proxiedUrl)
        preview(imgBlob)
      } catch (e) {
        // url could not be transformed into a blob.
        log.error('unable to transform image http url into blob', e)
        toast('Unable to load image from this website, please download and upload the image manually.', 'error')
      }
      return
    }

    if (imageUrl.match(/^data:image\/([a-z]+);base64,/)) {
      try {
        const imgBlob = gfx.dataUrlToBlob(imageUrl)
        preview(imgBlob)
      } catch (e) {
        // url could not be transformed into a blob.
        log.error('unable to transform image data url into blob', e)
      }
      return
    }

    // something else was pasted, ignore for now
    log.info(imageUrl)
    return
  }

  // check if an image was pasted
  const file = evt.clipboardData.files[0]
  if (!file) return
  preview(file)
}

const onFileSelect = (evt: Event) => {
  const target = (evt.target as HTMLInputElement)
  if (!target.files) return
  const file = target.files[0]
  if (!file) return
  preview(file)
}

const preview = (newFile: File | Blob) => {
  if (!newFile.type.startsWith('image/')) {
    log.error('file type is not supported', newFile.type)
    return
  }
  const r = new FileReader()
  r.readAsDataURL(newFile)
  r.onload = (ev: any) => {
    previewUrl.value = ev.target.result
    file.value = newFile as File
  }
}

const postToGallery = () => {
  if (!file.value) {
    return
  }

  emit('postToGalleryClick', {
    file: file.value,
    title: title.value,
    copyrightName: copyrightName.value,
    copyrightURL: copyrightURL.value,
    tags: tags.value,
    isPrivate: isPrivate.value,
  })
  reset()
}

const setupGameClick = () => {
  if (!file.value) {
    return
  }

  emit('setupGameClick', {
    file: file.value,
    title: title.value,
    copyrightName: copyrightName.value,
    copyrightURL: copyrightURL.value,
    tags: tags.value,
    isPrivate: isPrivate.value,
  })
  reset()
}

const onDrop = async (evt: DragEvent): Promise<boolean> => {
  droppable.value = false
  const img = imageFromDragEvt(evt)
  if (!img) {
    return false
  }
  evt.preventDefault()
  const file = img.getAsFile()
  if (!file) {
    toast('Image could not be loaded (Error 1)', 'error')
    return false
  }
  try {
    const f = await gfx.loadFileToBlob(file)
    preview(f)
  } catch (e) {
    toast('Image could not be loaded (Error 2)', 'error')
  }
  return false
}

const onDragover = (evt: DragEvent): boolean => {
  const img = imageFromDragEvt(evt)
  if (!img) {
    return false
  }
  droppable.value = true
  evt.preventDefault()
  return false
}

const onDragleave = () => {
  droppable.value = false
}

onMounted(() =>{
  window.addEventListener('paste', onPaste as (evt: Event) => Promise<void>)
})

onUnmounted(() =>{
  window.removeEventListener('paste', onPaste as (evt: Event) => Promise<void>)
})
</script>
