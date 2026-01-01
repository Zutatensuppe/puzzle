<template>
  <v-card
    class="user-avatar-upload-dialog-card"
  >
    <v-card-title>Upload Avatar</v-card-title>

    <v-container>
      <v-row>
        <v-col
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
                To upload an avatar, choose one of the following methods:
                <ul>
                  <li>Click this area to select an image for upload </li>
                  <li>Drag and drop an image into the area</li>
                  <li>Paste an image URL</li>
                  <li>Paste an image</li>
                </ul>
                <div class="text-disabled">
                  The avatar will be resized to a square of 400x400 pixels,
                  even if you upload a different resolution. To prevent
                  cutting off your avatar, please upload a square image.
                </div>
              </div>
            </label>
          </div>
        </v-col>
      </v-row>
      <v-row>
        <v-col>
          <v-card-actions>
            <v-btn
              v-if="userAvatarUploading"
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
              :disabled="!canSave"
              prepend-icon="mdi-content-save"
              color="success"
              @click="saveAvatar"
            >
              Save
            </v-btn>
            <v-btn
              variant="elevated"
              color="error"
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
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { logger } from '@common/Util'
import ResponsiveImage from '../ResponsiveImage.vue'
import { toast } from '../../toast'
import { Graphics } from '../../Graphics'
import { useDialog } from '../../useDialog'
import type { ImageDataURL } from '@common/Types'

const log = logger('NewImageDialog.vue')

const gfx = Graphics.getInstance()

const {
  userAvatarUploadProgress,
  userAvatarUploading,
  userAvatarOnSaveClick,
  closeDialog,
} = useDialog()

const previewUrl = ref<string>('')
const file = ref<Blob|null>(null)
const droppable = ref<boolean>(false)
const inputFocused = ref<boolean>(false)

const uploadProgressPercent = computed((): number => {
  return userAvatarUploadProgress.value ? Math.round(userAvatarUploadProgress.value * 100) : 0
})

const saveAvatar = async () => {
  if (!file.value || !userAvatarOnSaveClick.value) {
    return
  }

  await userAvatarOnSaveClick.value(file.value)
}

const canSave = computed((): boolean => {
  if (userAvatarUploading.value) {
    return false
  }
  return !!(previewUrl.value && file.value)
})

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
      try {
        await preview(await gfx.loader.blobFromSrc(imageUrl))
      } catch (e) {
        // url could not be transformed into a blob.
        log.error('unable to transform image http url into blob', e)
        toast('Unable to load image from this website, please download and upload the image manually.', 'error')
      }
      return
    }

    if (imageUrl.match(/^data:image\/([a-z]+);base64,/)) {
      try {
        await preview(gfx.loader.blobFromDataUrl(imageUrl as ImageDataURL))
      } catch (e) {
        // url could not be transformed into a blob.
        log.error('unable to transform image data url into blob', e)
        toast('Unable to process the pasted image, please upload the image file directly.', 'error')
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
  await preview(file)
}

const onFileSelect = async (evt: Event) => {
  const target = (evt.target as HTMLInputElement)
  if (!target.files) return
  const file = target.files[0]
  if (!file) return
  await preview(file)
}

const preview = async (blob: Blob): Promise<void> => {
  if (!blob.type.startsWith('image/')) {
    log.error('file type is not supported', blob.type)
    toast('Image could not be loaded (Error 3)', 'error')
    return
  }
  try {
    previewUrl.value = await gfx.loader.dataUrlFromBlob(blob)
    file.value = blob
  } catch (e) {
    log.error(e)
    toast('Image could not be loaded (Error 4)', 'error')
  }
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
    await preview(await gfx.loader.blobFromFile(file))
  } catch {
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
