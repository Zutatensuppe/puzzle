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

const log = logger('NewImageDialog.vue')

const fileToBlob = async (imageFile: File): Promise<Blob | null> => {
  return new Promise<Blob | null>((resolve) => {
    const r = new FileReader()
    r.readAsDataURL(imageFile)
    r.onload = async (ev: any) => {
      resolve(await imageUrlToBlob(ev.target.result))
    }
  })
}

const imageUrlToBlob = async (imageUrl: string): Promise<Blob | null> => {
  const imageElement = await imageUrlToImageElement(imageUrl)
  const canvasElement = await imageElementToCanvas(imageElement)
  return dataURLtoBlob(canvasElement.toDataURL())
}

const imageElementToCanvas = async (imageElement: HTMLImageElement): Promise<HTMLCanvasElement> => {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  canvas.width = imageElement.width
  canvas.height = imageElement.height
  ctx.drawImage(imageElement, 0, 0)
  return canvas
}

const imageUrlToImageElement = async (src: string): Promise<HTMLImageElement> => {
  return new Promise ((resolve, reject) => {
    const tmpImg = new Image()
    tmpImg.crossOrigin = 'anonymous'
    tmpImg.onload = () => {
      resolve(tmpImg)
    }
    tmpImg.onerror = (e) => {
      reject(e)
    }
    tmpImg.src = src
  })
}

function dataURLtoBlob(dataurl: string): Blob | null {
  const arr = dataurl.split(',')
  const m = arr[0].match(/:(.*?);/)
  if (!m) {
    return null
  }
  const mime = m[1]
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new Blob([u8arr], {type:mime})
}

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
      const proxiedUrl = '/api/proxy?' + new URLSearchParams({url: imageUrl})
      try {
        const imgBlob = await imageUrlToBlob(proxiedUrl)
        if (imgBlob) {
          preview(imgBlob)
        } else {
          // url could not be transformed into a blob.
          console.error('unable to transform image data url into blob')
          toast('Unable to load image from this website, please download and upload the image manually.', 'error')
        }
      } catch (e) {
        // url could not be transformed into a blob.
        console.error('unable to transform image http url into blob', e)
        toast('Unable to load image from this website, please download and upload the image manually.', 'error')
      }
    } else if (imageUrl.match(/^data:image\/([a-z]+);base64,/)) {
      try {
        const imgBlob = dataURLtoBlob(imageUrl)
        if (imgBlob) {
          preview(imgBlob)
        } else {
          // url could not be transformed into a blob.
          console.error('unable to transform image data url into blob')
        }
      } catch (e) {
        // url could not be transformed into a blob.
        console.error('unable to transform image data url into blob', e)
      }
    } else {
      // something else was pasted, ignore for now
      console.log(imageUrl)
    }
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
    console.error('file type is not supported', newFile.type)
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
  const f = await fileToBlob(file)
  if (!f) {
    toast('Image could not be loaded (Error 2)', 'error')
    return false
  }
  preview(f)
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
