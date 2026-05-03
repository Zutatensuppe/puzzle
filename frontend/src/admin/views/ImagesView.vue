<template>
  <v-container>
    <Nav />
    <h1>Images</h1>

    <div class="mb-4">
      <v-btn
        :disabled="detectingAi"
        :loading="detectingAi"
        variant="elevated"
        color="warning"
        size="small"
        prepend-icon="mdi-robot"
        @click="onDetectAi"
      >
        Detect AI images (scan all)
      </v-btn>
    </div>

    <Pagination
      v-if="images"
      :pagination="images.pagination"
      @click="onPagination"
    />
    <v-table
      v-if="images"
      density="compact"
    >
      <thead>
        <tr>
          <th>Preview</th>
          <th>Infos</th>
          <th>Games</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="item in images.items"
          :key="item.id"
        >
          <th>
            <a
              :href="`/uploads/${item.filename}`"
              target="_blank"
              class="image-holder"
            ><img
              :src="resizeUrl(`/image-service/image/${item.filename}`, 150, 100, 'contain')"
              :class="item.private ? ['image-private', 'image'] : ['image']"
            ></a>
          </th>
          <td>
            <div class="d-flex ga-3">
              <span class="text-disabled">Title:</span> {{ item.title || '-' }}
              <span class="text-disabled">Dimensions:</span> {{ item.width }}×{{ item.height }}
              <span class="text-disabled">Private:</span> <span :class="{ 'color-private': item.private }">{{ item.private ? '✓' : '✖' }}</span>
              <span class="text-disabled">NSFW:</span> {{ item.nsfw ? '😳 NSFW' : '-' }}
              <span class="text-disabled">AI:</span> {{ item.ai_generated ? '🤖 AI' : '-' }}
              <span class="text-disabled">State:</span> <code :class="`state-${item.state}`">{{ item.state }}</code>
              <template v-if="item.state === ImageState.Rejected && item.reject_reason">
                <span class="text-disabled">Reason:</span> <span :title="item.reject_reason">{{ item.reject_reason.length > 50 ? item.reject_reason.substring(0, 50) + '…' : item.reject_reason }}</span>
              </template>
            </div>
            <div class="d-flex ga-3">
              <span class="text-disabled">Id:</span> {{ item.id }}
              <span class="text-disabled">Uploader:</span> {{ item.uploader_user_id || '-' }}
              <span class="text-disabled">Created:</span> {{ item.created }}
            </div>
            <div class="d-flex ga-3">
              <span class="text-disabled">Filename:</span> {{ item.filename || '-' }}
            </div>
            <div class="d-flex ga-3">
              <span class="text-disabled">Original Filename:</span> {{ item.filename_original || '-' }}
            </div>
            <div class="d-flex ga-3">
              <span class="text-disabled">Copyright-Name:</span> {{ item.copyright_name || '-' }}
              <span class="text-disabled">Copyright-URL:</span> {{ item.copyright_url || '-' }}
            </div>
          </td>
          <td>{{ item.games_count }}</td>
          <td>
            <ImageActions
              :image="item"
              @updated="(patch) => Object.assign(item, patch)"
              @deleted="onImageDeleted(item)"
            />
          </td>
        </tr>
      </tbody>
    </v-table>
    <Pagination
      v-if="images"
      :pagination="images.pagination"
      @click="onPagination"
    />
  </v-container>
</template>
<script setup lang="ts">
import { onUnmounted, onMounted, ref } from 'vue'
import { resizeUrl } from '@common/ImageService'
import { me, onLoginStateChange } from '../../user'
import api from '../../_api'
import Nav from '../components/Nav.vue'
import ImageActions from '../components/ImageActions.vue'
import Pagination from '../../components/Pagination.vue'
import { ImageState } from '@common/Types'
import type { ImageRowWithCount, Pagination as PaginationType } from '@common/Types'

const perPage = 50
const images = ref<{ items: ImageRowWithCount[], pagination: PaginationType } | null>(null)
const detectingAi = ref(false)

const onDetectAi = async () => {
  detectingAi.value = true
  try {
    const resp = await api.admin.detectAiImages()
    if ('error' in resp) {
      alert(`Detection failed: ${resp.error}`)
    } else {
      alert(`Scanned ${resp.scanned} images, flagged ${resp.flagged} as AI.`)
      // reload current page to reflect changes
      if (images.value) {
        images.value = await loadImages({
          limit: perPage,
          offset: images.value.pagination.offset,
        })
      }
    }
  } finally {
    detectingAi.value = false
  }
}

const onImageDeleted = (image: ImageRowWithCount) => {
  if (images.value) {
    images.value.items = images.value.items.filter(i => i.id !== image.id)
  }
}

const loadImages = async (data: { limit: number, offset: number }) => {
  const responseData = await api.admin.getImages(data)
  if ('error' in responseData) {
    console.error('Error loading images:', responseData.error)
    return null
  }
  return responseData
}

const onPagination = async (q: { limit: number, offset: number }) => {
  if (!images.value) {
    return
  }
  images.value = await loadImages(q)
}

const onInit = async () => {
  images.value = me.value ? await loadImages({ limit: perPage, offset: 0 }) : null
}

let offLoginStateChange: () => void = () => {}
onMounted(async () => {
  await onInit()
  offLoginStateChange = onLoginStateChange(onInit)
})

onUnmounted(() => {
  offLoginStateChange()
})
</script>
<style scss scoped>
.state-approved,
.state-curated {
  color: green;
  font-weight: bold;
}
.state-rejected,
.state-uncurated {
  color: red;
  font-weight: bold;
}
.state-unreviewed {
  color: orange;
  font-weight: bold;
}
</style>
