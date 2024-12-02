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
        <ImagesRow
          v-for="image in images.items"
          :key="image.id"
          :image="image"
          @delete="onDelete(image)"
        />
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
import user from '../../user'
import api from '../../_api'
import Nav from '../components/Nav.vue'
import Pagination from '../../components/Pagination.vue'
import { ImageRowWithCount, Pagination as PaginationType } from '../../../../common/src/Types'
import ImagesRow from '../components/ImagesRow.vue'

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

const onPagination = async (q: { limit: number, offset: number }) => {
  if (!images.value) {
    return
  }
  images.value = await api.admin.getImages(q)
}

onMounted(async () => {
  if (user.getMe()) {
    images.value = await api.admin.getImages({ limit: perPage, offset: 0 })
  }
  user.eventBus.on('login', async () => {
    images.value = await api.admin.getImages({ limit: perPage, offset: 0 })
  })
  user.eventBus.on('logout', () => {
    images.value = null
  })
})
</script>
