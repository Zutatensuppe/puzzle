"New Game" page: Upload button big, centered, at the top of the page, as
visible as possible. Upload button has a warning that the image will
be added to public gallery, just so noone uploads anything naughty on
accident. The page can show all the images by default, or one of the categories
of images. Instead of categories, you can make the system tag-based, like
in jigsawpuzzles.io

<template>
  <div>
    <div class="upload-image-teaser">
      <div class="btn btn-big" @click="dialog='new-image'">Upload your image</div>
      <div class="hint">(The image you upload will be added to the public gallery.)</div>
    </div>

    <div>
      <label v-if="categories.length > 0">
        Category:
        <select v-model="filters.category" @change="filtersChanged">
          <option value="">All</option>
          <option v-for="(c, idx) in categories" :key="idx" :value="c.slug">{{c.title}}</option>
        </select>
      </label>
      <label>
        Sort by:
        <select v-model="filters.sort" @change="filtersChanged">
          <option value="date_desc">Newest first</option>
          <option value="date_asc">Oldest first</option>
          <option value="alpha_asc">A-Z</option>
          <option value="alpha_desc">Z-A</option>
        </select>
      </label>
    </div>
    <image-library :images="images" @imageClicked="imageClicked" />
    <new-image-dialog v-if="dialog==='new-image'" @bgclick="dialog=''" @postToGalleryClick="postToGalleryClick" @setupGameClick="setupGameClick" />
    <new-game-dialog v-if="image && dialog==='new-game'" @bgclick="dialog=''" @newGame="onNewGame" :image="image" />
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'

import ImageLibrary from './../components/ImageLibrary.vue'
import NewImageDialog from './../components/NewImageDialog.vue'
import NewGameDialog from './../components/NewGameDialog.vue'
import { GameSettings, Image } from '../../common/GameCommon'
import Util from '../../common/Util'

export default defineComponent({
  components: {
    ImageLibrary,
    NewImageDialog,
    NewGameDialog,
  },
  data() {
    return {
      filters: {
        sort: 'date_desc',
        category: '',
      },
      images: [],
      categories: [],

      image: {
        id: 0,
        filename: '',
        file: '',
        url: '',
        title: '',
        categories: [],
        created: 0,
      } as Image,

      dialog: '',
    }
  },
  async created() {
    await this.loadImages()
  },
  methods: {
    async loadImages () {
      const res = await fetch(`/api/newgame-data${Util.asQueryArgs(this.filters)}`)
      const json = await res.json()
      this.images = json.images
      this.categories = json.categories
    },
    async filtersChanged () {
      await this.loadImages()
    },
    imageClicked (image: Image) {
      this.image = image
      this.dialog = 'new-game'
    },
    async uploadImage (data: any) {
      const formData = new FormData();
      formData.append('file', data.file, data.file.name);
      formData.append('title', data.title)
      formData.append('category', data.category)

      const res = await fetch('/upload', {
        method: 'post',
        body: formData,
      })
      return await res.json()
    },
    async postToGalleryClick(data: any) {
      await this.uploadImage(data)
      this.dialog = ''
      await this.loadImages()
    },
    async setupGameClick (data: any) {
      const image = await this.uploadImage(data)
      this.loadImages() // load images in background
      this.image = image
      this.dialog = 'new-game'
    },
    async onNewGame(gameSettings: GameSettings) {
      const res = await fetch('/newgame', {
        method: 'post',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(gameSettings),
      })
      if (res.status === 200) {
        const game = await res.json()
        this.$router.push({ name: 'game', params: { id: game.id } })
      }
    },
  },
})
</script>
