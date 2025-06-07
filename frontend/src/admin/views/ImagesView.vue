<template>
  <v-container>
    <Nav />
    <h1>Images</h1>

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
            <span
              class="is-clickable"
              @click="onDelete(item)"
            >DELETE</span>
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
import { onMounted, ref } from 'vue'
import { resizeUrl } from '../../../../common/src/ImageService'
import user from '../../user'
import api from '../../_api'
import Nav from '../components/Nav.vue'
import Pagination from '../../components/Pagination.vue'
import { ImageRowWithCount, Pagination as PaginationType } from '../../../../common/src/Types'

const perPage = 50
const images = ref<{ items: ImageRowWithCount[], pagination: PaginationType } | null>(null)

const onDelete = async (image: ImageRowWithCount) => {
  if (!confirm(`Really delete image ${image.id}?`)) {
    return
  }

  const resp = await api.admin.deleteImage(image.id)
  if (resp.ok) {
    if (images.value) {
      images.value.items = images.value.items.filter(i => i.id !== image.id)
    }
    alert('Successfully deleted image!')
  } else {
    alert('Deleting image failed!')
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

onMounted(async () => {
  if (user.getMe()) {
    images.value = await loadImages({ limit: perPage, offset: 0 })
  }
  user.eventBus.on('login', async () => {
    images.value = await loadImages({ limit: perPage, offset: 0 })
  })
  user.eventBus.on('logout', () => {
    images.value = null
  })
})
</script>
