<template>
  <div>
    <Nav />
    <h1>Images</h1>
    <v-table>
      <thead>
        <tr>
          <th>Id</th>
          <th>Uploader</th>
          <th>Created</th>
          <th>Preview</th>
          <th>Filename</th>
          <th>Filename Original</th>
          <th>Title</th>
          <th>Width</th>
          <th>Height</th>
          <th>Private</th>
          <th>Copyright Name</th>
          <th>Copyright URL</th>

          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(item, idx) in images"
          :key="idx"
        >
          <td>{{ item.id }}</td>
          <td>{{ item.uploader_user_id || '-' }}</td>
          <td>{{ item.created }}</td>
          <th><img :src="resizeUrl(`/image-service/image/${item.filename}`, 150, 100, 'contain')"></th>
          <td>{{ item.filename }}</td>
          <td>{{ item.filename_original }}</td>
          <td>{{ item.title }}</td>
          <td>{{ item.width }}</td>
          <td>{{ item.height }}</td>
          <td>{{ item.private ? '✓' : '✖' }}</td>
          <td>{{ item.copyright_name }}</td>
          <td>{{ item.copyright_url }}</td>

          <td>
            <span
              class="is-clickable"
              @click="onDelete(item)"
            >DELETE</span>
          </td>
        </tr>
      </tbody>
    </v-table>
  </div>
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
