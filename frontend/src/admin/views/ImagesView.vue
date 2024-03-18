<template>
  <v-container>
    <Nav />
    <h1>Images</h1>
    <v-table density="compact">
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
          v-for="(item, idx) in images"
          :key="idx"
        >
          <th>
            <a
              :href="`/uploads/${item.filename}`"
              target="_blank"
            ><img :src="resizeUrl(`/image-service/image/${item.filename}`, 150, 100, 'contain')"></a>
          </th>
          <td>
            <div class="d-flex ga-3">
              <span class="text-disabled">Title:</span> {{ item.title || '-' }}
              <span class="text-disabled">Dimensions:</span> {{ item.width }}×{{ item.height }}
              <span class="text-disabled">Private:</span> {{ item.private ? '✓' : '✖' }}
            </div>
            <div class="d-flex ga-3">
              <span class="text-disabled">Id:</span> {{ item.id }}
              <span class="text-disabled">Uploader:</span> {{ item.uploader_user_id || '-' }}
              <span class="text-disabled">Created:</span> {{ item.created }}
            </div>
            <div class="d-flex ga-3">
              <span class="text-disabled">Filename:</span> {{ item.filename || '-' }}
              <span class="text-disabled">Original Filename:</span> {{ item.filename_original || '-' }}
            </div>
            <div class="d-flex ga-3">
              <span class="text-disabled">Copyright-Name:</span> {{ item.copyright_name || '-' }}
              <span class="text-disabled">Copyright-URL:</span> {{ item.copyright_url || '-' }}
            </div>
          </td>
          <td>{{ item.game_count }}</td>
          <td>
            <span
              class="is-clickable"
              @click="onDelete(item)"
            >DELETE</span>
          </td>
        </tr>
      </tbody>
    </v-table>
  </v-container>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { resizeUrl } from '../../../../common/src/ImageService'
import user from '../../user'
import api from '../../_api'
import Nav from '../components/Nav.vue'

const images = ref<any[]>([])

const onDelete = async (image: any) => {
  if (!confirm(`Really delete image ${image.id}?`)) {
    return
  }

  const resp = await api.admin.deleteImage(image.id)
  if (resp.ok) {
    images.value = images.value.filter(i => i.id !== image.id)
    alert('Successfully deleted image!')
  } else {
    alert('Deleting image failed!')
  }
}

onMounted(async () => {
  if (user.getMe()) {
    images.value = await api.admin.getImages()
  }
  user.eventBus.on('login', async () => {
    images.value = await api.admin.getImages()
  })
  user.eventBus.on('logout', () => {
    images.value = []
  })
})
</script>
