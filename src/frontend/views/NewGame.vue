"New Game" page: Upload button big, centered, at the top of the page, as
visible as possible. Upload button has a warning that the image will
be added to public gallery, just so noone uploads anything naughty on
accident. The page can show all the images by default, or one of the categories
of images. Instead of categories, you can make the system tag-based, like
in jigsawpuzzles.io

<template>
  <v-container
    :fluid="true"
    class="new-game-view p-0"
  >
    <v-row class="mt-2 mb-2">
      <v-col>
        <div
          :class="{blurred: dialog}"
          class="text-center"
        >
          <v-btn
            class="font-weight-bold mb-1"
            prepend-icon="mdi-image-plus-outline"
            size="large"
            color="info"
            @click="openDialog('new-image')"
          >
            Upload your image
          </v-btn>
          <div class="text-disabled">
            (The image you upload will be added to the public gallery.)
          </div>
        </div>
      </v-col>
    </v-row>
    <v-container
      :fluid="true"
      :class="{blurred: dialog }"
      class="mb-2 d-flex"
    >
      <h3 class="mr-5">
        Featured Artists:
      </h3>
      <v-btn
        variant="text"
        :to="{ name: 'featured-artist', params: { artist: 'LisadiKaprio' }}"
      >
        <img
          src="../assets/featured-artist/lisa.png"
          width="32"
          height="32"
          style="border-radius:32px;"
          class="mr-3"
        >
        LisadiKaprio
      </v-btn>
      <v-btn
        variant="text"
        :to="{ name: 'featured-artist', params: { artist: 'PEAKY_kun' }}"
      >
        <img
          src="../assets/featured-artist/peaky.png"
          width="32"
          height="32"
          style="border-radius:32px;"
          class="mr-3"
        >
        PEAKY_kun
      </v-btn>
    </v-container>
    <v-container
      :fluid="true"
      :class="{blurred: dialog }"
      class="filters mb-2"
    >
      <div>
        <v-select
          v-model="filters.sort"
          class="sorting"
          density="compact"
          label="Sorting:"
          item-title="title"
          item-value="val"
          :items="[
            { val: ImageSearchSort.DATE_DESC, title: 'Newest first'},
            { val: ImageSearchSort.DATE_ASC, title: 'Oldest first'},
            { val: ImageSearchSort.ALPHA_ASC, title: 'A-Z'},
            { val: ImageSearchSort.ALPHA_DESC, title: 'Z-A'},
            { val: ImageSearchSort.GAME_COUNT_DESC, title: 'Most plays first'},
            { val: ImageSearchSort.GAME_COUNT_ASC, title: 'Least plays first'},
          ]"
        />
      </div>
      <div>
        <v-text-field
          v-model="filters.search"
          density="compact"
          label="Type in keywords..."
        />
      </div>
    </v-container>
    <ImageLibrary
      :class="{blurred: dialog }"
      :images="images"
      @imageClicked="onImageClicked"
      @imageEditClicked="onImageEditClicked"
    />
    <Sentinel
      v-if="sentinelActive"
      @sighted="tryLoadMore"
    />
    <v-dialog v-model="dialog">
      <NewImageDialog
        v-if="dialogContent==='new-image'"
        :autocomplete-tags="autocompleteTags"
        :upload-progress="uploadProgress"
        :uploading="uploading"
        @postToGalleryClick="postToGalleryClick"
        @setupGameClick="setupGameClick"
        @tagClick="onTagClick"
        @close="closeDialog"
      />
      <EditImageDialog
        v-if="dialogContent==='edit-image'"
        :autocomplete-tags="autocompleteTags"
        :image="image"
        @save-click="onSaveImageClick"
        @close="closeDialog"
      />
      <NewGameDialog
        v-if="image && dialogContent==='new-game'"
        :image="image"
        @new-game="onNewGame"
        @tag-click="onTagClick"
        @close="closeDialog"
      />
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import NewImageDialog from './../components/NewImageDialog.vue'
import EditImageDialog from './../components/EditImageDialog.vue'
import NewGameDialog from './../components/NewGameDialog.vue'
import { GameSettings, ImageInfo, Tag, NewGameDataRequestData, ImagesRequestData, ImageSearchSort, isImageSearchSort } from '../../common/Types'
import api from '../_api'
import { XhrRequest } from '../_api/xhr'
import { onBeforeRouteUpdate, RouteLocationNormalizedLoaded, useRouter } from 'vue-router'
import ImageLibrary from './../components/ImageLibrary.vue'
import Sentinel from '../components/Sentinel.vue'
import { debounce } from '../util'

const router = useRouter()

const filters = ref<{ sort: ImageSearchSort, search: string }>({
  sort: ImageSearchSort.DATE_DESC,
  search: '',
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
  private: false,
})

const dialog = ref<boolean>(false)
const dialogContent = ref<string>('')

const uploading = ref<'postToGallery' | 'setupGame' | ''>('')
const uploadProgress = ref<number>(0)

// const relevantTags = computed((): Tag[] => tags.value.filter((tag: Tag) => tag.total > 0))

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

watch(filters, () => {
  filtersChangedDebounced()
}, { deep: true })

const currentRequest = ref<XhrRequest | null>(null)

const loadImages = async () => {
  sentinelActive.value = false
  offset.value = 0
  const requestData: NewGameDataRequestData = {
    sort: filters.value.sort,
    search: filters.value.search,
  }
  if (currentRequest.value) {
    currentRequest.value.abort()
  }
  currentRequest.value = api.pub.newgameData(requestData)
  const res = await currentRequest.value.send()
  currentRequest.value = null
  const json = await res.json()
  images.value = json.images
  tags.value = json.tags
  sentinelActive.value = true
}

const filtersChanged = async () => {
  await loadImages()
  router.push({ name: 'new-game', query: { sort: filters.value.sort, search: filters.value.search }})
  sentinelActive.value = true
}
const filtersChangedDebounced = debounce(filtersChanged, 300)

const onTagClick = (tag: Tag): void => {
  closeDialog()
  shouldInitFiltersFromRoute.value = true
  router.push({ name: 'new-game', query: { sort: ImageSearchSort.DATE_DESC, search: tag.title } })
}

const onImageClicked = (newImage: ImageInfo) => {
  image.value = newImage
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
    },
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
  const requestData: ImagesRequestData = {
    sort: filters.value.sort,
    search: filters.value.search,
    offset: offset.value,
  }
  if (currentRequest.value) {
    currentRequest.value.abort()
  }
  currentRequest.value = api.pub.images(requestData)
  const res = await currentRequest.value.send()
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

const initFilters = (route: RouteLocationNormalizedLoaded) => {
  const query = route.query
  filters.value.search = (query && query.search) ? `${query.search}` : ''
  filters.value.sort = (query && isImageSearchSort(query.sort)) ? query.sort : ImageSearchSort.DATE_DESC
}

const shouldInitFiltersFromRoute = ref<boolean>(false)
const onPopstate = () => {
  shouldInitFiltersFromRoute.value = true
}
onBeforeRouteUpdate(async (to, from) => {
  if (shouldInitFiltersFromRoute.value) {
    initFilters(to)
    shouldInitFiltersFromRoute.value = false
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('popstate', onPopstate)
})
onMounted(async () => {
  shouldInitFiltersFromRoute.value = false
  window.addEventListener('popstate', onPopstate)
  initFilters(router.currentRoute.value)
  await loadImages()
})
</script>
