<template>
  <v-container>
    <Nav />
    <h1>Approvals</h1>
    <p class="text-disabled mb-2">
      Public images pending approval (oldest first). {{ pendingCount }} pending.
    </p>

    <Pagination
      v-if="images"
      :pagination="images.pagination"
      @click="onPagination"
    />
    <div
      v-if="images && images.items.length === 0"
      class="text-h6 my-4"
    >
      🎉 No images pending approval!
    </div>
    <v-table
      v-if="images && images.items.length > 0"
      density="compact"
    >
      <thead>
        <tr>
          <th>Preview</th>
          <th>Infos</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="item in images.items"
          :key="item.id"
        >
          <td>
            <a
              :href="`/uploads/${item.filename}`"
              target="_blank"
              class="image-holder"
            ><img
              :src="resizeUrl(`/image-service/image/${item.filename}`, 500, 350, 'contain')"
              class="image"
            ></a>
          </td>
          <td>
            <div class="d-flex ga-3">
              <span class="text-disabled">Title:</span> {{ item.title || '-' }}
              <span class="text-disabled">Dimensions:</span> {{ item.width }}×{{ item.height }}
              <span class="text-disabled">NSFW:</span> {{ item.nsfw ? '😳 NSFW' : '-' }}
            </div>
            <div class="d-flex ga-3">
              <span class="text-disabled">Id:</span> {{ item.id }}
              <span class="text-disabled">Uploader:</span> {{ item.uploader_user_name || item.uploader_user_id || '-' }}
              <span class="text-disabled">Created:</span> {{ item.created }}
            </div>
            <div class="d-flex ga-3">
              <span class="text-disabled">Copyright:</span> {{ item.copyright_name || '-' }}
              <template v-if="item.copyright_url">
                (<a
                  :href="item.copyright_url"
                  target="_blank"
                >{{ item.copyright_url }}</a>)
              </template>
            </div>
          </td>
          <td>
            <div class="d-flex ga-1">
              <v-btn
                size="small"
                color="green"
                @click="onApprove(item)"
              >
                APPROVE
              </v-btn>
              <v-btn
                size="small"
                color="red"
                @click="onReject(item)"
              >
                REJECT
              </v-btn>
              <v-btn
                size="small"
                @click="onSetPrivate(item)"
              >
                SET PRIVATE
              </v-btn>
              <v-btn
                size="small"
                color="error"
                variant="outlined"
                @click="onDelete(item)"
              >
                DELETE
              </v-btn>
            </div>
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
import { onUnmounted, onMounted, ref, computed } from 'vue'
import { resizeUrl } from '@common/ImageService'
import { me, onLoginStateChange } from '../../user'
import api from '../../_api'
import Nav from '../components/Nav.vue'
import Pagination from '../../components/Pagination.vue'
import type { ImageRowWithCount, Pagination as PaginationType } from '@common/Types'

const perPage = 50
const images = ref<{ items: ImageRowWithCount[], pagination: PaginationType } | null>(null)

const pendingCount = computed(() => images.value?.pagination.total ?? 0)

const removeItem = (item: ImageRowWithCount) => {
  if (images.value) {
    images.value.items = images.value.items.filter(i => i.id !== item.id)
    images.value.pagination.total--
  }
}

const onApprove = async (image: ImageRowWithCount) => {
  const resp = await api.admin.approveImage(image.id)
  if ('error' in resp || !resp.ok) {
    alert('Approving image failed!')
  } else {
    removeItem(image)
  }
}

const onReject = async (image: ImageRowWithCount) => {
  const reason = prompt('Rejection reason (optional):') ?? ''
  const resp = await api.admin.rejectImage(image.id, reason)
  if ('error' in resp || !resp.ok) {
    alert('Rejecting image failed!')
  } else {
    removeItem(image)
  }
}

const onSetPrivate = async (image: ImageRowWithCount) => {
  if (!confirm(`Set image ${image.id} as private? This cannot be undone!`)) {
    return
  }
  const resp = await api.admin.setImagePrivate(image.id)
  if ('error' in resp || !resp.ok) {
    alert('Setting image to private failed!')
  } else {
    removeItem(image)
  }
}

const onDelete = async (image: ImageRowWithCount) => {
  if (!confirm(`Really delete image ${image.id}?`)) {
    return
  }
  const resp = await api.admin.deleteImage(image.id)
  if ('error' in resp || !resp.ok) {
    alert('Deleting image failed!')
  } else {
    removeItem(image)
  }
}

const loadImages = async (data: { limit: number, offset: number }) => {
  const responseData = await api.admin.getPendingImages(data)
  if ('error' in responseData) {
    console.error('Error loading pending images:', responseData.error)
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
