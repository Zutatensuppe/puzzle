<template>
  <v-container
    v-if="featured"
    :fluid="true"
    class="featured-view p-0"
  >
    <div class="featured-content">
      <v-card class="pa-5 mb-5 d-flex">
        <div class="justify-start flex-grow-1 mr-5 pr-5">
          <h3>{{ featured.name }}</h3>
          <div v-if="featured.introduction">
            {{ featured.introduction }}
          </div>
        </div>
        <div
          v-if="featured.links.length > 0"
          class="justify-end featured-links ml-5"
        >
          <h3>Links</h3>
          <div
            v-for="(link, idx) in featured.links"
            :key="idx"
          >
            <a
              :href="link.url"
              target="_blank"
            >{{ link.title }}</a>
          </div>
        </div>
      </v-card>

      <h3 v-if="featured.collections.length > 0">
        Collections
      </h3>
      <v-card
        v-for="(collection, idx) of featured.collections"
        :key="idx"
        class="pa-5 mb-5"
      >
        <div>
          <h4>{{ collection.name }}</h4>
          <ImageLibrary
            :images="collection.images"
            :edit="false"
            @image-clicked="onImageClicked"
          />
        </div>
      </v-card>
    </div>
  </v-container>

  <v-dialog v-model="dialog">
    <NewGameDialog
      v-if="image && dialogContent==='new-game'"
      :image="image"
      @new-game="onNewGame"
      @close="closeDialog"
    />
  </v-dialog>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { defaultImageInfo } from '../../../common/src/Types'
import type { FeaturedRowWithCollections, GameSettings, ImageInfo } from '../../../common/src/Types'
import ImageLibrary from '../components/ImageLibrary.vue'
import NewGameDialog from '../components/NewGameDialog.vue'
import api from '../_api'
import { toast } from '../toast'

const route = useRoute()
const router = useRouter()

const featured = ref<FeaturedRowWithCollections | null>(null)

const image = ref<ImageInfo>(defaultImageInfo())

const dialog = ref<boolean>(false)
const dialogContent = ref<string>('')

const openDialog = (content: string) => {
  dialogContent.value = content
  dialog.value = true
}

const closeDialog = () => {
  dialogContent.value = ''
  dialog.value = false
}

const onNewGame = async (gameSettings: GameSettings) => {
  const res = await api.pub.newGame({ gameSettings })
  const game = await res.json()
  if ('id' in game) {
    void router.push({ name: 'game', params: { id: game.id } })
  } else {
    toast('An error occured while creating the game.', 'error')
  }
}

const onImageClicked = (newImage: ImageInfo) => {
  image.value = newImage
  openDialog('new-game')
}

onMounted(async () => {
  const type = route.params.artist ? 'artist' : 'category'
  // TODO: remove toLowerCase after a while, it is only required now because of old browser caches.
  const slug = `${route.params.artist || route.params.category}`.toLowerCase()

  const res = await api.pub.getFeaturedData({ type, slug })
  const data = await res.json()
  if ('featured' in data) {
    featured.value = data.featured
  } else {
    toast('An error occured while loading the featured data.', 'error')
  }
})
</script>
