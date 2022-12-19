<template>
  <Overlay class="new-image-dialog" @close="emit('close')">
    <template v-slot:default>
      <div
        class="area-image"
        :class="{'has-image': !!previewUrl, 'no-image': !previewUrl, droppable: droppable}"
        @drop="onDrop"
        @dragover="onDragover"
        @dragleave="onDragleave">
        <div class="drop-target"></div>
        <div v-if="previewUrl" class="has-image">
          <span class="remove btn" @click="previewUrl=''">X</span>
          <ResponsiveImage :src="previewUrl" />
        </div>
        <div v-else>
          <label class="upload">
            <input type="file" style="display: none" @change="onFileSelect" accept="image/*" />
            <div class="upload-content">
              How to upload an image? Choose any of the following methods:
              <ul>
                <li>Click this area to select an image for upload </li>
                <li>Drag and drop an image into the area</li>
                <li>Paste an image URL</li>
                <li>Paste an image</li>
              </ul>
              <div class="hint">
                Don't worry, the image will not show up in the gallery
                unless "Post to gallery" was clicked.
              </div>
            </div>
          </label>
        </div>
      </div>

      <div class="area-settings">
        <table>
          <tr>
            <td><label>Title</label></td>
            <td><input type="text" v-model="title" placeholder="Flower by @artist" @focus="inputFocused = true" @blur="inputFocused=false" /></td>
          </tr>
          <tr>
            <td colspan="2">
              <div class="hint">Feel free to leave a credit to the artist/photographer in the title :)</div>
            </td>
          </tr>
          <tr>
            <td><label>Private Image</label></td>
            <td class="checkbox-only">
              <input type="checkbox" v-model="isPrivate" />
            </td>
          </tr>
          <tr>
            <td colspan="2">
              <div class="hint">Private images won't show up in the gallery.</div>
            </td>
          </tr>
          <tr>
            <td><label>Tags</label></td>
            <td>
              <TagsInput v-model="tags" :autocompleteTags="autocompleteTags" />
            </td>
          </tr>
        </table>
      </div>

      <div class="area-buttons">
        <button class="btn"
          v-if="!isPrivate"
          :disabled="!canPostToGallery"
          @click="postToGallery"
        >
          <template v-if="uploading === 'postToGallery'">Uploading ({{uploadProgressPercent}}%)</template>
          <template v-else><icon icon="preview" /> Post to gallery</template>
        </button>
        <button class="btn"
          :disabled="!canSetupGameClick"
          @click="setupGameClick"
        >
          <template v-if="uploading === 'setupGame'">Uploading ({{uploadProgressPercent}}%)</template>
          <template v-else-if="isPrivate"><icon icon="puzzle-piece" /> Set up game</template>
          <template v-else><icon icon="puzzle-piece" /> Post to gallery <br /> + set up game</template>
        </button>
        <button class="btn" @click="emit('close')">Cancel</button>
      </div>
    </template>
  </Overlay>
</template>
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { FrontendGameSettings as FrontendNewImageEventData } from '../../common/Types';
import { logger } from '../../common/Util'
import TagsInput from '../components/TagsInput.vue'
import Overlay from './Overlay.vue';
import ResponsiveImage from './ResponsiveImage.vue';

const log = logger('NewImageDialog.vue')

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
    const tmpImg = new Image();
    tmpImg.crossOrigin = "anonymous";
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
  uploading: "" | "postToGallery" | "setupGame"
}>()

const emit = defineEmits<{
  (e: 'setupGameClick', val: FrontendNewImageEventData): void
  (e: 'postToGalleryClick', val: FrontendNewImageEventData): void
  (e: 'close'): void
}>()

const previewUrl = ref<string>('')
const file = ref<File|null>(null)
const title = ref<string>('')
const tags = ref<string[]>([])
const isPrivate = ref<boolean>(false)
const droppable = ref<boolean>(false)
const inputFocused = ref<boolean>(false)

const uploadProgressPercent = computed((): number => {
  return props.uploadProgress ? Math.round(props.uploadProgress * 100) : 0
})

const canPostToGallery = computed((): boolean => {
  if (props.uploading) {
    return false
  }
  return !!(previewUrl.value && file.value)
})

const canSetupGameClick = computed((): boolean => {
  if (props.uploading) {
    return false
  }
  return !!(previewUrl.value && file.value)
})

const reset = (): void => {
  previewUrl.value = ''
  file.value = null
  title.value = ''
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
      return;
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
        }
      } catch (e) {
        // url could not be transformed into a blob.
        console.error('unable to transform image http url into blob', e)
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
  if (!file) return;
  preview(file)
}

const onFileSelect = (evt: Event) => {
  const target = (evt.target as HTMLInputElement)
  if (!target.files) return;
  const file = target.files[0]
  if (!file) return;

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
    tags: tags.value,
    isPrivate: isPrivate.value,
  })
  reset()
}

const onDrop = (evt: DragEvent): boolean => {
  droppable.value = false
  const img = imageFromDragEvt(evt)
  if (!img) {
    return false
  }
  const f = img.getAsFile()
  if (!f) {
    return false
  }
  file.value = f
  preview(f)
  evt.preventDefault()
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
