"New Game" page: Upload button big, centered, at the top of the page, as
visible as possible. Upload button has a warning that the image will
be added to public gallery, just so noone uploads anything naughty on
accident. The page can show all the images by default, or one of the categories
of images. Instead of categories, you can make the system tag-based, like
in jigsawpuzzles.io

<template>
  <div>
    <div class="upload-image-teaser" :class="{blurred: dialog !== ''}">
      <div class="btn is-big" @click="dialog='new-image'">Upload your image</div>
      <div class="hint">(The image you upload will be added to the public gallery.)</div>
    </div>

    <div :class="{blurred: dialog !== ''}">
      <label v-if="tags.length > 0">
        Tags:
        <span
          class="bit is-clickable"
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
          <option value="game_count_asc">Most plays first</option>
          <option value="game_count_desc">Least plays first</option>
        </select>
      </label>
    </div>
    <ImageLibrary
      :class="{blurred: dialog !== ''}"
      :images="images"
      @imageClicked="onImageClicked"
      @imageEditClicked="onImageEditClicked" />
    <NewImageDialog
      v-if="dialog==='new-image'"
      :autocompleteTags="autocompleteTags"
      @close="dialog=''"
      @bgclick="dialog=''"
      :uploadProgress="uploadProgress"
      :uploading="uploading"
      @postToGalleryClick="postToGalleryClick"
      @setupGameClick="setupGameClick"
      />
    <EditImageDialog
      v-if="dialog==='edit-image'"
      :autocompleteTags="autocompleteTags"
      @close="dialog=''"
      @bgclick="dialog=''"
      @saveClick="onSaveImageClick"
      :image="image" />
    <NewGameDialog
      v-if="image && dialog==='new-game'"
      @close="dialog=''"
      @bgclick="dialog=''"
      @newGame="onNewGame"
      :image="image"
      :forcePrivate="newGameForcePrivate" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import NewImageDialog from './../components/NewImageDialog.vue'
import EditImageDialog from './../components/EditImageDialog.vue'
import NewGameDialog from './../components/NewGameDialog.vue'
import { GameSettings, ImageInfo, Tag } from '../../common/Types'
import api from '../_api'
import { useRouter } from 'vue-router'
import ImageLibrary from './../components/ImageLibrary.vue'

const router = useRouter()

const filters = ref<{ sort: string, tags: string[] }>({
  sort: 'date_desc',
  tags: [],
})
const images = ref<ImageInfo[]>([])

const tags = ref<Tag[]>([])
const image = ref<ImageInfo>({
  id: 0,
  uploaderUserId: null,
  filename: '',
  url: '',
  title: '',
  tags: [],
  created: 0,
  width: 0,
  height: 0,
})

const dialog = ref<string>('')
const newGameForcePrivate = ref<boolean>(false)
const uploading = ref<'postToGallery' | 'setupGame' | ''>('')
const uploadProgress = ref<number>(0)

const relevantTags = computed((): Tag[] => tags.value.filter((tag: Tag) => tag.total > 0))

const autocompleteTags = (input: string, exclude: string[]): string[] => {
  return tags.value
    .filter((tag: Tag) => {
      return !exclude.includes(tag.title)
        && tag.title.toLowerCase().startsWith(input.toLowerCase())
    })
    .slice(0, 10)
    .map((tag: Tag) => tag.title)
}
const toggleTag = (t: Tag) => {
  if (filters.value.tags.includes(t.slug)) {
    filters.value.tags = filters.value.tags.filter(slug => slug !== t.slug)
  } else {
    filters.value.tags.push(t.slug)
  }
  filtersChanged()
}
const loadImages = async () => {
  const res = await api.pub.newgameData({ filters: filters.value })
  const json = await res.json()
  images.value = json.images
  tags.value = json.tags
}
const filtersChanged = async () => {
  await loadImages()
}
const onImageClicked = (newImage: ImageInfo) => {
  image.value = newImage
  newGameForcePrivate.value = false
  dialog.value = 'new-game'
}
const onImageEditClicked = (newImage: ImageInfo) => {
  image.value = newImage
  dialog.value = 'edit-image'
}
const uploadImage = async (data: any) => {
  uploadProgress.value = 0
  const res = await api.pub.upload({
    file: data.file,
    title: data.title,
    tags: data.tags,
    isPrivate: data.isPrivate,
    onProgress: (progress: number): void => {
      uploadProgress.value = progress
    }
  })
  uploadProgress.value = 1
  return await res.json()
}
const onSaveImageClick = async (data: any) => {
  const res = await api.pub.saveImage(data)
  const json = await res.json()
  if (json.ok) {
    dialog.value = ''
    await loadImages()
  } else {
    alert(json.error)
  }
}
const postToGalleryClick = async (data: any) => {
  uploading.value = 'postToGallery'
  await uploadImage(data)
  uploading.value = ''
  dialog.value = ''
  await loadImages()
}
const setupGameClick = async (data: any) => {
  uploading.value = 'setupGame'
  const image = await uploadImage(data)
  uploading.value = ''
  loadImages() // load images in background
  image.value = image
  newGameForcePrivate.value = data.isPrivate
  dialog.value = 'new-game'
}
const onNewGame = async (gameSettings: GameSettings) => {
  const res = await api.pub.newGame({ gameSettings })
  if (res.status === 200) {
    const game = await res.json()
    router.push({ name: 'game', params: { id: game.id } })
  }
}

onMounted(async () => {
  await loadImages()
})
</script>
