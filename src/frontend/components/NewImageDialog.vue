"Upload image" clicked: what it looks like when the image was uploaded.
Probably needs a (x) in the upper right corner of the image to allow the
user to remove the image if a wrong one was selected. The image should
be uploaded to the actual gallery only when the user presses "post to
gallery", if possible!
<template>
  <div class="overlay new-image-dialog" @click="$emit('bgclick')">
    <div class="overlay-content" @click.stop="">

      <div class="area-image" :class="{'has-image': !!image.url, 'no-image': !image.url}">
        <!-- TODO: ...  -->
        <div v-if="image.url" class="has-image">
          <span class="remove btn" @click="image.url=''">X</span>
          <responsive-image :src="image.url" />
        </div>
        <div v-else>
          <!-- TODO: drop area for image -->
          <upload class="upload" @uploaded="mediaImgUploaded($event)" accept="image/*" label="Upload an image" />
        </div>
      </div>

      <div class="area-settings">
        <table>
          <tr>
            <td><label>Title</label></td>
            <td><input type="text" v-model="image.title" placeholder="Flower by @artist" /></td>
          </tr>
          <tr>
            <td colspan="2">
              <div class="hint">Feel free to leave a credit to the artist/photographer in the title :)</div>
            </td>
          </tr>
          <tr>
            <!-- TODO: autocomplete category -->
            <td><label>Category</label></td>
            <td><input type="text" v-model="image.category" placeholder="Plants" /></td>
          </tr>
        </table>
      </div>

      <div class="area-buttons">
        <!-- <button class="btn" :disabled="!canPostToGallery" @click="postToGallery">🖼️ Post to gallery</button> -->
        <button class="btn" :disabled="!canSetupGameClick" @click="setupGameClick">🧩 Post to gallery <br /> + set up game</button>
      </div>

    </div>
  </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'

import Upload from './Upload.vue'
import ResponsiveImage from './ResponsiveImage.vue'
import { Image } from '../../common/GameCommon'

export default defineComponent({
  name: 'new-image-dialog',
  components: {
    Upload,
    ResponsiveImage,
  },
  emits: {
    bgclick: null,
    setupGameClick: null,
  },
  data () {
    return {
      image: {
        file: '',
        url: '',
        title: '',
        category: '',
      } as Image,
    }
  },
  computed: {
    canPostToGallery () {
      return !!this.image.url
    },
    canSetupGameClick () {
      return !!this.image.url
    },
  },
  methods: {
    mediaImgUploaded(data: any) {
      this.image.file = data.image.file
      this.image.url = data.image.url
    },
    postToGallery () {
      this.$emit('postToGallery', this.image)
    },
    setupGameClick () {
      this.$emit('setupGameClick', this.image)
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
}
.new-image-dialog .area-image.no-image {
  align-content: center;
  display: grid;
  text-align: center;
  margin: 20px;
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
