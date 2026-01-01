<template>
  <v-container
    :fluid="true"
    class="new-game-view p-0"
  >
    <v-row class="mt-2 mb-2">
      <v-col>
        <div
          :class="{ blurred: currentDialog }"
          class="text-center"
        >
          <v-btn
            class="font-weight-bold mb-1"
            prepend-icon="mdi-image-plus-outline"
            size="large"
            color="info"
            @click="onUploadImageClicked"
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
      v-if="featuredTeasers.length > 0"
      :fluid="true"
      :class="{ blurred: currentDialog }"
      class="mb-2 d-flex"
    >
      <div class="featured-section mb-2 ga-5">
        <FeaturedButton
          v-for="teaser in featuredTeasers"
          :key="teaser.id"
          :featured="teaser"
          @click="goToFeatured(teaser)"
        />
      </div>
    </v-container>
    <v-container
      :fluid="true"
      :class="{ blurred: currentDialog }"
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
      :class="{ blurred: currentDialog }"
      :images="images"
      @image-clicked="onImageClicked"
      @image-edit-clicked="onImageEditClicked"
    />
    <Sentinel
      v-if="sentinelActive"
      @sighted="tryLoadMore"
    />
  </v-container>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { ImageSearchSort, isImageSearchSort } from '@common/Types'
import type { Api, GameSettings, ImageInfo, Tag, FeaturedRowWithCollections } from '@common/Types'
import api from '../_api'
import type { XhrRequest } from '../_api/xhr'
import { onBeforeRouteUpdate, useRouter } from 'vue-router'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import ImageLibrary from './../components/ImageLibrary.vue'
import Sentinel from '../components/Sentinel.vue'
import { debounce } from '../util'
import FeaturedButton from '../components/FeaturedButton.vue'
import { useDialog } from '../useDialog'
import { toast } from '../toast'
import { uploadImage } from '../upload'

const router = useRouter()

const goToFeatured = async (featured: FeaturedRowWithCollections) => {
  if (featured.type === 'artist') {
    await router.push({ name: 'featured-artist', params: { artist: featured.slug }})
  } else {
    await router.push({ name: 'featured-category', params: { category: featured.slug }})
  }
}

const filters = ref<{ sort: ImageSearchSort, search: string }>({
  sort: ImageSearchSort.DATE_DESC,
  search: '',
})
const offset = ref<number>(0)

const images = ref<ImageInfo[]>([])

const sentinelActive = ref<boolean>(false)

const tags = ref<Tag[]>([])

const uploading = ref<'postToGallery' | 'setupGame' | ''>('')

const { openEditImageDialog, openNewImageDialog, openNewGameDialog, closeDialog, currentDialog } = useDialog()

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
  void filtersChangedDebounced()
}, { deep: true })

const featuredTeasers = ref<FeaturedRowWithCollections[]>([])
const loadFeaturedTeasers = async () => {
  const res = await api.pub.getFeaturedTeaserData()
  const json = await res.json()
  featuredTeasers.value = json.featuredTeasers
}

const currentNewGameDataRequest = ref<XhrRequest<Api.NewGameDataResponseData> | null>(null)
const currentImagesRequest = ref<XhrRequest<Api.ImagesResponseData> | null>(null)

const loadImages = async () => {
  sentinelActive.value = false
  offset.value = 0
  const requestData: Api.NewGameDataRequestData = {
    sort: filters.value.sort,
    search: filters.value.search,
  }
  if (currentNewGameDataRequest.value) {
    currentNewGameDataRequest.value.abort()
  }
  if (currentImagesRequest.value) {
    currentImagesRequest.value.abort()
  }
  currentNewGameDataRequest.value = api.pub.newgameData(requestData)
  const res = await currentNewGameDataRequest.value.send()
  currentNewGameDataRequest.value = null
  const json = await res.json()
  images.value = json.images
  tags.value = json.tags
  sentinelActive.value = true
}

const filtersChanged = async () => {
  await loadImages()
  void router.push({ name: 'new-game', query: { sort: filters.value.sort, search: filters.value.search }})
  sentinelActive.value = true
}
const filtersChangedDebounced = debounce(filtersChanged, 300)

const onTagClick = (tag: Tag): void => {
  closeDialog()
  shouldInitFiltersFromRoute.value = true
  void router.push({ name: 'new-game', query: { sort: ImageSearchSort.DATE_DESC, search: tag.title } })
}

const onImageClicked = (image: ImageInfo) => {
  openNewGameDialog({
    image,
    onNewGameClick,
    onTagClick,
  })
}

const onImageEditClicked = (image: ImageInfo) => {
  openEditImageDialog({
    image,
    autocompleteTags,
    onSaveImageClick: async (data: Api.SaveImageRequestData) => {
      const res = await api.pub.saveImage(data)
      const json = await res.json()
      if (json.ok) {
        closeDialog()
        // TODO: the image could now not match the filters anymore.
        //       but it is probably fine to not reload the whole list at this point
        const idx = images.value.findIndex(img => img.id === data.id)
        images.value[idx] = json.imageInfo
      } else {
        toast(json.error, 'error')
      }
    },
  })
}

const onUploadImageClicked = () => {
  openNewImageDialog({
    autocompleteTags,
    postToGalleryClick,
    setupGameClick,
  })
}

const postToGalleryClick = async (data: Api.UploadRequestData) => {
  uploading.value = 'postToGallery'
  const result = await uploadImage(data)
  uploading.value = ''
  closeDialog()

  if ('error' in result) {
    toast(result.error, 'error')
    return
  }

  await loadImages()
}

const setupGameClick = async (data: Api.UploadRequestData) => {
  uploading.value = 'setupGame'
  const result = await uploadImage(data)
  uploading.value = ''

  if ('error' in result) {
    toast(result.error, 'error')
    return
  }

  void loadImages() // load images in background

  openNewGameDialog({
    image: result.imageInfo,
    onNewGameClick,
    onTagClick,
  })
}

const onNewGameClick = async (gameSettings: GameSettings) => {
  const res = await api.pub.newGame({ gameSettings })
  const game = await res.json()
  if ('id' in game) {
    closeDialog()
    void router.push({ name: 'game', params: { id: game.id } })
  } else {
    toast('An error occured while creating the game.', 'error')
  }
}

const tryLoadMore = async () => {
  if (currentNewGameDataRequest.value || currentImagesRequest.value) {
    // still loading
    return
  }

  offset.value = images.value.length
  const requestData: Api.ImagesRequestData = {
    sort: filters.value.sort,
    search: filters.value.search,
    offset: offset.value,
  }
  currentImagesRequest.value = api.pub.images(requestData)
  let json: { images: ImageInfo[] }
  try {
    const res = await currentImagesRequest.value.send()
    json = await res.json()
    currentImagesRequest.value = null
  } catch {
    currentImagesRequest.value = null
    return
  }

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
onBeforeRouteUpdate((to, _from) => {
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
  await loadFeaturedTeasers()
  await loadImages()
})
</script>
