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
      <label v-if="tags.length > 0">
        Tags:
        <span
          class="bit"
          v-for="(t,idx) in relevantTags"
          :key="idx"
          @click="toggleTag(t)"
          :class="{on: filters.tags.includes(t.slug)}">{{t.title}} ({{t.total}})</span>
        <!-- <select v-model="filters.tags" @change="filtersChanged">
          <option value="">All</option>
          <option v-for="(c, idx) in tags" :key="idx" :value="c.slug">{{c.title}}</option>
        </select> -->
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
    <image-library
      :images="images"
      @imageClicked="onImageClicked"
      @imageEditClicked="onImageEditClicked" />
    <new-image-dialog
      v-if="dialog==='new-image'"
      :autocompleteTags="autocompleteTags"
      @bgclick="dialog=''"
      @postToGalleryClick="postToGalleryClick"
      @setupGameClick="setupGameClick" />
    <edit-image-dialog
      v-if="dialog==='edit-image'"
      :autocompleteTags="autocompleteTags"
      @bgclick="dialog=''"
      @saveClick="onSaveImageClick"
      :image="image" />
    <new-game-dialog
      v-if="image && dialog==='new-game'"
      @bgclick="dialog=''"
      @newGame="onNewGame"
      :image="image" />
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'

import ImageLibrary from './../components/ImageLibrary.vue'
import NewImageDialog from './../components/NewImageDialog.vue'
import EditImageDialog from './../components/EditImageDialog.vue'
import NewGameDialog from './../components/NewGameDialog.vue'
import { GameSettings, Image, Tag } from '../../common/Types'
import Util from '../../common/Util'

export default defineComponent({
  components: {
    ImageLibrary,
    NewImageDialog,
    EditImageDialog,
    NewGameDialog,
  },
  data() {
    return {
      filters: {
        sort: 'date_desc',
        tags: [] as string[],
      },
      images: [],
      tags: [] as Tag[],

      image: {
        id: 0,
        filename: '',
        file: '',
        url: '',
        title: '',
        tags: [],
        created: 0,
      } as Image,

      dialog: '',
    }
  },
  async created() {
    await this.loadImages()
  },
  computed: {
    relevantTags (): Tag[] {
      return this.tags.filter((tag: Tag) => tag.total > 0)
    },
  },
  methods: {
    autocompleteTags (input: string, exclude: string[]): string[] {
      return this.tags
        .filter((tag: Tag) => {
          return !exclude.includes(tag.title)
            && tag.title.toLowerCase().startsWith(input.toLowerCase())
        })
        .slice(0, 10)
        .map((tag: Tag) => tag.title)
    },
    toggleTag (t: Tag) {
      if (this.filters.tags.includes(t.slug)) {
        this.filters.tags = this.filters.tags.filter(slug => slug !== t.slug)
      } else {
        this.filters.tags.push(t.slug)
      }
      this.filtersChanged()
    },
    async loadImages () {
      const res = await fetch(`/api/newgame-data${Util.asQueryArgs(this.filters)}`)
      const json = await res.json()
      this.images = json.images
      this.tags = json.tags
    },
    async filtersChanged () {
      await this.loadImages()
    },
    onImageClicked (image: Image) {
      this.image = image
      this.dialog = 'new-game'
    },
    onImageEditClicked (image: Image) {
      this.image = image
      this.dialog = 'edit-image'
    },
    async uploadImage (data: any) {
      const formData = new FormData();
      formData.append('file', data.file, data.file.name);
      formData.append('title', data.title)
      formData.append('tags', data.tags)

      const res = await fetch('/api/upload', {
        method: 'post',
        body: formData,
      })
      return await res.json()
    },
    async saveImage (data: any) {
      const res = await fetch('/api/save-image', {
        method: 'post',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: data.id,
          title: data.title,
          tags: data.tags,
        }),
      })
      return await res.json()
    },
    async onSaveImageClick(data: any) {
      await this.saveImage(data)
      this.dialog = ''
      await this.loadImages()
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
      const res = await fetch('/api/newgame', {
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
