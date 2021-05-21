"Upload image" clicked: what it looks like when the image was uploaded.
Probably needs a (x) in the upper right corner of the image to allow the
user to remove the image if a wrong one was selected. The image should
be uploaded to the actual gallery only when the user presses "post to
gallery", if possible!
<template>
  <div class="overlay new-image-dialog" @click="$emit('bgclick')">
    <div class="overlay-content" @click.stop="">

      <div class="area-image" :class="{'has-image': !!previewUrl, 'no-image': !previewUrl}">
        <!-- TODO: ...  -->
        <div v-if="previewUrl" class="has-image">
          <span class="remove btn" @click="previewUrl=''">X</span>
          <responsive-image :src="previewUrl" />
        </div>
        <div v-else>
          <label class="upload">
            <input type="file" style="display: none" @change="preview" accept="image/*" />
            <span class="btn">{{label || 'Upload File'}}</span>
          </label>


          <!-- TODO: drop area for image -->
          <!-- <upload class="upload" @uploaded="mediaImgUploaded($event)" accept="image/*" label="Upload an image" /> -->
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
            <!-- TODO: autocomplete category -->
            <td><label>Category</label></td>
            <td><input type="text" v-model="category" placeholder="Plants" /></td>
          </tr>
        </table>
      </div>

      <div class="area-buttons">
        <button class="btn" :disabled="!canPostToGallery" @click="postToGallery">🖼️ Post to gallery</button>
        <button class="btn" :disabled="!canSetupGameClick" @click="setupGameClick">🧩 Post to gallery <br /> + set up game</button>
      </div>

    </div>
  </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'

import Upload from './Upload.vue'
import ResponsiveImage from './ResponsiveImage.vue'

export default defineComponent({
  name: 'new-image-dialog',
  components: {
    Upload,
    ResponsiveImage,
  },
  emits: {
    bgclick: null,
    setupGameClick: null,
    postToGalleryClick: null,
  },
  data () {
    return {
      previewUrl: '',
      file: null as File|null,
      title: '',
      category: '',
    }
  },
  computed: {
    canPostToGallery (): boolean {
      return !!(this.previewUrl && this.file)
    },
    canSetupGameClick (): boolean {
      return !!(this.previewUrl && this.file)
    },
  },
  methods: {
    preview (evt: Event) {
      const target = (evt.target as HTMLInputElement)
      if (!target.files) return;
      const file = target.files[0]
      if (!file) return;

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
        category: this.category,
      })
    },
    setupGameClick () {
      this.$emit('setupGameClick', {
        file: this.file,
        title: this.title,
        category: this.category,
      })
    },
  },
})
</script>

// TODO: scoped vs .new-image-dialog
<style>
.new-image-dialog .overlay-content {
  display: grid;
  grid-template-columns: auto 450px;
  grid-template-rows: auto;
  grid-template-areas:
    "image settings"
    "image buttons";
  height: 90%;
  width: 80%;
}

.new-image-dialog .area-image {
  grid-area: image;
  margin: 20px;
}
.new-image-dialog .area-image.no-image {
  align-content: center;
  display: grid;
  text-align: center;
  border: dashed 6px;
  position: relative;
}
.new-image-dialog .area-image .has-image {
  position: relative;
  width: 100%;
  height: 100%;
}
.new-image-dialog .area-image .has-image .remove {
  position: absolute;
  top: .5em;
  left: .5em;
}

.new-image-dialog .area-settings {
  grid-area: settings;
}

.new-image-dialog .area-settings table input[type="text"] {
  width: 100%;
  box-sizing: border-box;
}

.new-image-dialog .area-buttons {
  align-self: end;
  grid-area: buttons;
}
.new-image-dialog .area-buttons button {
  width: 100%;
  margin-top: .5em;
}
.new-image-dialog .upload {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  cursor: pointer;
}
.new-image-dialog .upload .btn {
  position: absolute;
  top: 50%;
  transform: translate(-50%,-50%);
}
</style>
