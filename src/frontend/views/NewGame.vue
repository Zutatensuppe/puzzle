"New Game" page: Upload button big, centered, at the top of the page, as
visible as possible. Upload button has a warning that the image will
be added to public gallery, just so noone uploads anything naughty on
accident. The page can show all the images by default, or one of the categories
of images. Instead of categories, you can make the system tag-based, like
in jigsawpuzzles.io

<template>
  <v-container :fluid="true" class="new-game-view p-0">
    <v-row class="mt-2 mb-2">
      <v-col>
        <div :class="{blurred: dialog}" class="text-center">
          <v-btn
            class="font-weight-bold mb-1"
            @click="openDialog('new-image')"
            prepend-icon="mdi-image-plus-outline"
            size="large"
            color="info"
          >Upload your image</v-btn>
          <div class="text-disabled">(The image you upload will be added to the public gallery.)</div>
        </div>
      </v-col>
    </v-row>
    <v-container :fluid="true" :class="{blurred: dialog }" class="mb-2 d-flex">
      <h3 class="mr-5">Featured Artists:</h3>
      <v-btn variant="text" :to="{ name: 'featured-artist', params: { artist: 'LisadiKaprio' }}">
        <img src="../assets/featured-artist/lisa.png" width="32" height="32"
        style="border-radius:32px;" class="mr-3" />
        LisadiKaprio
      </v-btn>
      <v-btn variant="text" :to="{ name: 'featured-artist', params: { artist: 'PEAKY_kun' }}">
        <img src="../assets/featured-artist/peaky.png" width="32" height="32"
        style="border-radius:32px;" class="mr-3" />
        PEAKY_kun
      </v-btn>
    </v-container>
    <v-container :fluid="true" :class="{blurred: dialog }" class="filters mb-2">
      <div>
        <v-select
          class="sorting"
          density="compact"
          label="Sorting:"
          v-model="filters.sort"
          item-title="title"
          item-value="val"
          :items="[
            { val: 'date_desc', title: 'Newest first'},
            { val: 'date_asc', title: 'Oldest first'},
            { val: 'alpha_asc', title: 'A-Z'},
            { val: 'alpha_desc', title: 'Z-A'},
            { val: 'game_count_desc', title: 'Most plays first'},
            { val: 'game_count_asc', title: 'Least plays first'},
          ]"
          @update:modelValue="filtersChanged"
        ></v-select>
      </div>
      <div>
        <template v-if="tags.length > 0">
          <v-label>Tags:</v-label>
          <v-chip
            v-for="(t,idx) in relevantTags"
            filter
            :key="idx"
            @click="toggleTag(t)"
            :prepend-icon="filters.tags.includes(t.slug) ? 'mdi-check' : undefined"
            density="compact"
            class="is-clickable"
          >{{t.title}} ({{t.total}})</v-chip>
        </template>
      </div>
    </v-container>
    <ImageLibrary
      :class="{blurred: dialog }"
      :images="images"
      @imageClicked="onImageClicked"
      @imageEditClicked="onImageEditClicked"
    />
    <Sentinel @sighted="tryLoadMore" v-if="sentinelActive" />
    <v-dialog v-model="dialog">
      <NewImageDialog
        v-if="dialogContent==='new-image'"
        :autocompleteTags="autocompleteTags"
        :uploadProgress="uploadProgress"
        :uploading="uploading"
        @postToGalleryClick="postToGalleryClick"
        @setupGameClick="setupGameClick"
        @close="closeDialog"
        />
      <EditImageDialog
        v-if="dialogContent==='edit-image'"
        :autocompleteTags="autocompleteTags"
        :image="image"
        @saveClick="onSaveImageClick"
        @close="closeDialog"
      />
      <NewGameDialog
        v-if="image && dialogContent==='new-game'"
        :image="image"
        :forcePrivate="newGameForcePrivate"
        @newGame="onNewGame"
        @close="closeDialog"
      />
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import NewImageDialog from './../components/NewImageDialog.vue'
import EditImageDialog from './../components/EditImageDialog.vue'
import NewGameDialog from './../components/NewGameDialog.vue'
import { GameSettings, ImageInfo, Tag } from '../../common/Types'
import api from '../_api'
import { useRouter } from 'vue-router'
import ImageLibrary from './../components/ImageLibrary.vue'
import Sentinel from '../components/Sentinel.vue'

const router = useRouter()

const filters = ref<{ sort: string, tags: string[] }>({
  sort: 'date_desc',
  tags: [],
})
const offset = ref<number>(0)

const images = ref<ImageInfo[]>([])

const sentinelActive = ref<boolean>(false)

const tags = ref<Tag[]>([])
const image = ref<ImageInfo>({
  id: 0,
  uploaderUserId: null,
  uploaderName: '',
  filename: '',
  url: '',
  title: '',
  tags: [],
  created: 0,
  width: 0,
  height: 0,
  gameCount: 0,
  copyrightName: '',
  copyrightURL: '',
})

const dialog = ref<boolean>(false)
const dialogContent = ref<string>('')

const newGameForcePrivate = ref<boolean>(false)
const uploading = ref<'postToGallery' | 'setupGame' | ''>('')
const uploadProgress = ref<number>(0)

const relevantTags = computed((): Tag[] => tags.value.filter((tag: Tag) => tag.total > 0))

const openDialog = (content: string) => {
  dialogContent.value = content
  dialog.value = true
}

const closeDialog = () => {
  dialogContent.value = ''
  dialog.value = false
}

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

watch(filters, () => {
  filtersChanged()
}, { deep: true })

const loadImages = async () => {
  sentinelActive.value = false
  offset.value = 0
  const _filters = {
    sort: filters.value.sort,
    tags: filters.value.tags,
    offset: offset.value,
  }
  const res = await api.pub.newgameData({ filters: _filters })
  const json = await res.json()
  images.value = json.images
  tags.value = json.tags
  sentinelActive.value = true
}

const filtersChanged = async () => {
  await loadImages()
  sentinelActive.value = true
}

const onImageClicked = (newImage: ImageInfo) => {
  image.value = newImage
  newGameForcePrivate.value = false
  openDialog('new-game')
}

const onImageEditClicked = (newImage: ImageInfo) => {
  image.value = newImage
  openDialog('edit-image')
}

const uploadImage = async (data: any) => {
  uploadProgress.value = 0
  const res = await api.pub.upload({
    file: data.file,
    title: data.title,
    copyrightName: data.copyrightName,
    copyrightURL: data.copyrightURL,
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
    closeDialog()
    // TODO: the image could now not match the filters anymore.
    //       but it is probably fine to not reload the whole list at this point
    const idx = images.value.findIndex(img => img.id === data.id)
    images.value[idx] = json.image
  } else {
    alert(json.error)
  }
}

const postToGalleryClick = async (data: any) => {
  uploading.value = 'postToGallery'
  await uploadImage(data)
  uploading.value = ''
  closeDialog()
  await loadImages()
}

const setupGameClick = async (data: any) => {
  uploading.value = 'setupGame'
  const uploadedImage = await uploadImage(data)
  uploading.value = ''
  loadImages() // load images in background
  image.value = uploadedImage
  newGameForcePrivate.value = data.isPrivate
  openDialog('new-game')
}

const onNewGame = async (gameSettings: GameSettings) => {
  const res = await api.pub.newGame({ gameSettings })
  if (res.status === 200) {
    const game = await res.json()
    router.push({ name: 'game', params: { id: game.id } })
  }
}

const tryLoadMore = async () => {
  offset.value = images.value.length
  const _filters = {
    sort: filters.value.sort,
    tags: filters.value.tags,
    offset: offset.value,
  }
  const res = await api.pub.images({ filters: _filters })
  const json = await res.json()
  if (json.images.length === 0) {
    sentinelActive.value = false
  } else {
    // sentinel may be disabled.. but why? :(
    // anyway for now we enable it again if images were loaded
    sentinelActive.value = true
  }
  images.value.push(...json.images)
}

onMounted(async () => {
  await loadImages()
})
</script>
