"Upload image" clicked: what it looks like when the image was uploaded.
Probably needs a (x) in the upper right corner of the image to allow the
user to remove the image if a wrong one was selected. The image should
be uploaded to the actual gallery only when the user presses "post to
gallery", if possible!
<template>
  <overlay class="new-image-dialog">
    <template v-slot:default>
      <div
        class="area-image"
        :class="{'has-image': !!previewUrl, 'no-image': !previewUrl, droppable: droppable}"
        @drop="onDrop"
        @dragover="onDragover"
        @dragleave="onDragleave">
        <!-- TODO: ...  -->
        <div class="drop-target"></div>
        <div v-if="previewUrl" class="has-image">
          <span class="remove btn" @click="previewUrl=''">X</span>
          <responsive-image :src="previewUrl" />
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
              <tags-input v-model="tags" :autocompleteTags="autocompleteTags" />
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
        <button class="btn" @click="$emit('close')">Cancel</button>
      </div>
    </template>
  </overlay>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import { logger } from '../../common/Util'

const log = logger('NewImageDialog.vue')

const imageUrlToBlob = async (imageUrl: string): Promise<Blob> => {
  const imageElement = await imageUrlToImageElement(imageUrl)
  const canvasElement = await imageElementToCanvas(imageElement)
  return dataURLtoBlob(canvasElement.toDataURL())
}

const imageElementToCanvas = async (imageElement: HTMLImageElement): Promise<HTMLCanvasElement> => {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
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

function dataURLtoBlob(dataurl: string): Blob {
  var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
      bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
  while(n--){
      u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], {type:mime});
}

export default defineComponent({
  props: {
    autocompleteTags: {
      type: Function,
    },
    uploadProgress: {
      type: Number,
    },
    uploading: {
      type: String,
    },
  },
  emits: ['setupGameClick', 'postToGalleryClick', 'close'],
  data () {
    return {
      previewUrl: '',
      file: null as File|null,
      title: '',
      tags: [] as string[],
      isPrivate: false,
      droppable: false,
      inputFocused: false,
    }
  },
  computed: {
    uploadProgressPercent (): number {
      return this.uploadProgress ? Math.round(this.uploadProgress * 100) : 0
    },
    canPostToGallery (): boolean {
      if (this.uploading) {
        return false
      }
      return !!(this.previewUrl && this.file)
    },
    canSetupGameClick (): boolean {
      if (this.uploading) {
        return false
      }
      return !!(this.previewUrl && this.file)
    },
  },
  mounted () {
    window.addEventListener('paste', this.onPaste)
  },
  unmounted () {
    window.removeEventListener('paste', this.onPaste)
  },
  methods: {
    reset(): void {
      this.previewUrl = ''
      this.file = null
      this.title = ''
      this.tags = []
      this.isPrivate = false
      this.droppable = false
    },
    imageFromDragEvt (evt: DragEvent): DataTransferItem|null {
      const items = evt.dataTransfer?.items
      if (!items || items.length === 0) {
        return null
      }
      const item = items[0]
      if (!item.type.startsWith('image/')) {
        return null
      }
      return item
    },
    async onPaste (evt: ClipboardEvent) {
      if (!evt.clipboardData) {
        return
      }
      // check if a url was pasted
      const imageUrl = evt.clipboardData.getData('text')
      if (imageUrl) {
        if (this.inputFocused) {
          return;
        }
        if (imageUrl.match(/^https?:\/\//)) {
          // need to proxy because of X-Origin
          const proxiedUrl = '/api/proxy?' + new URLSearchParams({url: imageUrl})
          try {
            const imgBlob = await imageUrlToBlob(proxiedUrl)
            this.preview(imgBlob)
          } catch (e) {
            // url could not be transformed into a blob.
            console.error('unable to transform image http url into blob', e)
          }
        } else if (imageUrl.match(/^data:image\/([a-z]+);base64,/)) {
          try {
            const imgBlob = dataURLtoBlob(imageUrl)
            this.preview(imgBlob)
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
      this.preview(file)
    },
    onFileSelect (evt: Event) {
      const target = (evt.target as HTMLInputElement)
      if (!target.files) return;
      const file = target.files[0]
      if (!file) return;

      this.preview(file)
    },
    preview (file: File | Blob) {
      if (!file.type.startsWith('image/')) {
        console.error('file type is not supported', file.type)
        return
      }
      const r = new FileReader()
      r.readAsDataURL(file)
      r.onload = (ev: any) => {
        this.previewUrl = ev.target.result
        this.file = file
      }
    },
    postToGallery () {
      this.$emit('postToGalleryClick', {
        file: this.file,
        title: this.title,
        tags: this.tags,
        isPrivate: this.isPrivate,
      })
      this.reset()
    },
    setupGameClick () {
      this.$emit('setupGameClick', {
        file: this.file,
        title: this.title,
        tags: this.tags,
        isPrivate: this.isPrivate,
      })
      this.reset()
    },
    onDrop (evt: DragEvent): boolean {
      this.droppable = false
      const img = this.imageFromDragEvt(evt)
      if (!img) {
        return false
      }
      const f = img.getAsFile()
      if (!f) {
        return false
      }
      this.file = f
      this.preview(f)
      evt.preventDefault()
      return false
    },
    onDragover (evt: DragEvent): boolean {
      const img = this.imageFromDragEvt(evt)
      if (!img) {
        return false
      }
      this.droppable = true
      evt.preventDefault()
      return false
    },
    onDragleave () {
      this.droppable = false
    },
  },
})
</script>
