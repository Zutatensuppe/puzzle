<template>
  <v-container v-if="artist" :fluid="true" class="featured-artist-view p-0">
    <div class="featured-artist-content">
      <v-card class="pa-5 mb-5 d-flex">
        <div class="justify-start flex-grow-1 mr-5 pr-5">
          <h3>{{ artist.name }}</h3>
          <div>{{ artist.introduction }}</div>
        </div>
        <div class="justify-end featured-artist-links ml-5">
          <h3>Links</h3>
          <div v-for="link in artist.links">
            <a :href="link.url" target="_blank">{{ link.title }}</a>
          </div>
        </div>
      </v-card>

      <h3 v-if="collections.length > 0">Collections</h3>
      <v-card class="pa-5 mb-5" v-for="collection of collections">
        <div>
          <h4>{{ collection.name }}</h4>
          <ImageLibrary
            :images="collection.images"
            :edit="false"
            @imageClicked="onImageClicked"
          />
        </div>
      </v-card>
    </div>
  </v-container>

  <v-dialog v-model="dialog">
    <NewGameDialog
      v-if="image && dialogContent==='new-game'"
      :image="image"
      :forcePrivate="false"
      @newGame="onNewGame"
      @close="closeDialog"
    />
  </v-dialog>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { GameSettings, ImageInfo } from '../../common/Types';
import ImageLibrary from '../components/ImageLibrary.vue';
import NewGameDialog from '../components/NewGameDialog.vue';
import api from '../_api';

const route = useRoute()
const router = useRouter()

const artist = ref<any>(null)
const collections = ref<any[]>([])

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
  if (res.status === 200) {
    const game = await res.json()
    router.push({ name: 'game', params: { id: game.id } })
  }
}

const onImageClicked = (newImage: ImageInfo) => {
  image.value = newImage
  openDialog('new-game')
}

onMounted(async () => {
  const res = await api.pub.getArtistData({
    name: `${route.params.artist}`,
  })
  const data = await res.json()
  artist.value = data.artist
  collections.value = data.collections
})
</script>
