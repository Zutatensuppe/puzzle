<template>
  <v-container>
    <Nav />
    <h1>Uploaders</h1>

    <div class="mb-4">
      <v-btn
        color="primary"
        :disabled="recomputingTrust"
        @click="onRecomputeTrust"
      >
        Recompute Trust for All Uploaders
      </v-btn>
      <span
        v-if="recomputeResult"
        class="ml-3"
      >{{ recomputeResult }}</span>
    </div>

    <Pagination
      v-if="uploaders"
      :pagination="uploaders.pagination"
      @click="onPagination"
    />
    <v-table
      v-if="uploaders"
      density="compact"
    >
      <thead>
        <tr>
          <th />
          <th>User Id</th>
          <th>Name</th>
          <th>Trusted</th>
          <th>Approved</th>
          <th>Rejected</th>
          <th>Pending</th>
          <th>Total</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <template
          v-for="item in uploaders.items"
          :key="item.id"
        >
          <tr>
            <td>
              <v-btn
                size="x-small"
                variant="text"
                :icon="expandedUsers[item.id] ? 'mdi-chevron-up' : 'mdi-chevron-down'"
                @click="toggleExpand(item)"
              />
            </td>
            <td>{{ item.id }}</td>
            <td>{{ item.name || '-' }}</td>
            <td>
              <span :class="item.trusted ? 'trusted-yes' : 'trusted-no'">
                {{ item.trusted ? '✓ Trusted' : '✖ Not trusted' }}
              </span>
              <span
                v-if="item.trustManuallySet"
                class="text-caption ml-1"
                title="Manually set by admin — won't be changed by automatic recomputation"
              >(manual)</span>
            </td>
            <td>{{ item.approvedCount }}</td>
            <td>{{ item.rejectedCount }}</td>
            <td>{{ item.pendingCount }}</td>
            <td>{{ item.totalCount }}</td>
            <td>
              <div class="d-flex ga-1">
                <v-btn
                  v-if="!item.trusted"
                  size="x-small"
                  color="green"
                  @click="onTrust(item)"
                >
                  TRUST
                </v-btn>
                <v-btn
                  v-else
                  size="x-small"
                  color="red"
                  @click="onUntrust(item)"
                >
                  UNTRUST
                </v-btn>
                <v-btn
                  v-if="item.trustManuallySet"
                  size="x-small"
                  variant="outlined"
                  @click="onResetTrust(item)"
                >
                  RESET TO AUTO
                </v-btn>
              </div>
            </td>
          </tr>
          <tr v-if="expandedUsers[item.id]">
            <td
              colspan="9"
              class="pa-3"
            >
              <div
                v-if="!userImages[item.id]"
                class="text-disabled"
              >
                Loading...
              </div>
              <div
                v-else-if="userImages[item.id].length === 0"
                class="text-disabled"
              >
                No images found.
              </div>
              <div
                v-else
                class="d-flex flex-wrap ga-2"
              >
                <div
                  v-for="img in userImages[item.id]"
                  :key="img.id"
                  class="image-thumb"
                >
                  <a
                    :href="`/uploads/${img.filename}`"
                    target="_blank"
                  >
                    <img
                      :src="resizeUrl(`/image-service/image/${img.filename}`, 100, 70, 'contain')"
                      :title="`${img.title || img.filename} [${img.state}]${img.state === 'rejected' && img.reject_reason ? ' - ' + img.reject_reason : ''}`"
                      :class="`thumb-${img.state}`"
                    >
                  </a>
                  <div class="text-caption">
                    <code :class="`state-${img.state}`">{{ img.state }}</code>
                  </div>
                </div>
              </div>
            </td>
          </tr>
        </template>
      </tbody>
    </v-table>
    <Pagination
      v-if="uploaders"
      :pagination="uploaders.pagination"
      @click="onPagination"
    />
  </v-container>
</template>
<script setup lang="ts">
import { onUnmounted, onMounted, ref, reactive } from 'vue'
import { resizeUrl } from '@common/ImageService'
import { me, onLoginStateChange } from '../../user'
import api from '../../_api'
import Nav from '../components/Nav.vue'
import Pagination from '../../components/Pagination.vue'
import type { ImageRowWithCount, Pagination as PaginationType, UploaderInfo, UserId } from '@common/Types'

const perPage = 50
const uploaders = ref<{ items: UploaderInfo[], pagination: PaginationType } | null>(null)
const recomputingTrust = ref(false)
const recomputeResult = ref('')
const expandedUsers = reactive<Record<number, boolean>>({})
const userImages = reactive<Record<number, ImageRowWithCount[]>>({})

const toggleExpand = async (item: UploaderInfo) => {
  const id = item.id as number
  if (expandedUsers[id]) {
    expandedUsers[id] = false
    return
  }
  expandedUsers[id] = true
  if (!userImages[id]) {
    const resp = await api.admin.getImages({ limit: 100, offset: 0, uploaderUserId: item.id })
    if ('error' in resp) {
      userImages[id] = []
    } else {
      userImages[id] = resp.items
    }
  }
}

const onRecomputeTrust = async () => {
  if (!confirm('Recompute trust status for all uploaders based on their approval history?')) {
    return
  }
  recomputingTrust.value = true
  recomputeResult.value = ''
  const resp = await api.admin.recomputeTrust()
  recomputingTrust.value = false
  if ('error' in resp) {
    recomputeResult.value = `Error: ${resp.error}`
  } else {
    recomputeResult.value = `Done! Recomputed trust for ${resp.count} uploaders.`
    // Reload the list to reflect changes
    uploaders.value = await loadUploaders({ limit: perPage, offset: 0 })
  }
}

const onTrust = async (item: UploaderInfo) => {
  const resp = await api.admin.trustUser(item.id)
  if ('error' in resp || !resp.ok) {
    alert('Trusting user failed!')
  } else {
    item.trusted = 1
    item.trustManuallySet = 1
  }
}

const onUntrust = async (item: UploaderInfo) => {
  const resp = await api.admin.untrustUser(item.id)
  if ('error' in resp || !resp.ok) {
    alert('Untrusting user failed!')
  } else {
    item.trusted = 0
    item.trustManuallySet = 1
  }
}

const onResetTrust = async (item: UploaderInfo) => {
  const resp = await api.admin.resetUserTrust(item.id)
  if ('error' in resp || !resp.ok) {
    alert('Resetting trust failed!')
  } else {
    item.trustManuallySet = 0
    // Reload to get the recomputed trust value
    const data = uploaders.value ? await loadUploaders({
      limit: perPage,
      offset: uploaders.value.pagination.offset,
    }) : null
    if (data) {
      uploaders.value = data
    }
  }
}

const loadUploaders = async (data: { limit: number, offset: number }) => {
  const responseData = await api.admin.getUploaders(data)
  if ('error' in responseData) {
    console.error('Error loading uploaders:', responseData.error)
    return null
  }
  return responseData
}

const onPagination = async (q: { limit: number, offset: number }) => {
  if (!uploaders.value) {
    return
  }
  uploaders.value = await loadUploaders(q)
}

const onInit = async () => {
  uploaders.value = me.value ? await loadUploaders({ limit: perPage, offset: 0 }) : null
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
.trusted-yes {
  color: green;
  font-weight: bold;
}
.trusted-no {
  color: grey;
}
.image-thumb {
  text-align: center;
}
.image-thumb img {
  border: 2px solid transparent;
  border-radius: 4px;
}
.thumb-approved img,
img.thumb-approved {
  border-color: green;
}
.thumb-rejected img,
img.thumb-rejected {
  border-color: red;
}
.thumb-pending_approval img,
img.thumb-pending_approval {
  border-color: orange;
}
.state-approved {
  color: green;
}
.state-rejected {
  color: red;
}
.state-pending_approval {
  color: orange;
}
</style>
