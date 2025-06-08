<template>
  <v-container>
    <Nav />

    <div class="d-flex justify-space-between">
      <h1>Featured Teasers</h1>
      <v-btn
        :color="hasChanges ? 'success' : undefined"
        :disabled="!hasChanges"
        @click="onSaveClick"
      >
        Save
      </v-btn>
    </div>

    <div
      v-if="featuredTeasers"
      class="featured-section mb-2 ga-5"
    >
      <div
        v-for="(item, idx) in featuredTeasers.items"
        :key="item.id"
      >
        <v-checkbox
          v-model="item.active"
          :false-value="0"
          :true-value="1"
          density="compact"
          :hide-details="true"
          label="Active"
        />
        <div class="d-flex ga-3">
          <span
            class="is-clickable"
            @click="moveTeaser(idx, -1)"
          >◀</span>
          <span
            class="is-clickable"
            @click="moveTeaser(idx, +1)"
          >▶</span>
        </div>
        <FeaturedButton
          :featured="item.featured"
        />
      </div>
    </div>

    <h1>Items</h1>
    <div>
      <v-btn :to="{name: 'admin_featured_edit', params: { id: 0 } }">
        Create
      </v-btn>
    </div>

    <v-table
      v-if="featureds"
      density="compact"
    >
      <thead>
        <tr>
          <th>id</th>
          <th>created</th>
          <th>name</th>
          <th>type</th>
          <th>introduction</th>
          <th>links</th>
          <th>actions</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="item in featureds.items"
          :key="item.id"
        >
          <td>{{ item.id }}</td>
          <td>{{ item.created }}</td>
          <td>{{ item.name }}</td>
          <td>{{ item.type }}</td>
          <td>{{ item.introduction }}</td>
          <td>{{ item.links }}</td>
          <td>
            <v-btn :to="{name: 'admin_featured_edit', params: { id: item.id } }">
              EDIT
            </v-btn>
          </td>
        </tr>
      </tbody>
    </v-table>
  </v-container>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import user from '../../user'
import api from '../../_api'
import Nav from '../components/Nav.vue'
import type { FeaturedRowWithCollections, FeaturedTeaserRow } from '../../../../common/src/Types'
import FeaturedButton from '../../components/FeaturedButton.vue'
import { arrayMove } from '../../../../common/src/Util'

type FeaturedTeaserRowFeaturedRow = FeaturedTeaserRow & { featured: FeaturedRowWithCollections }

const featureds = ref<{ items: FeaturedRowWithCollections[] } | null>(null)
const featuredTeasers = ref<{ items: FeaturedTeaserRowFeaturedRow[] } | null>(null)

const featuredTeasersJson = ref<string>(JSON.stringify(featuredTeasers.value))

const hasChanges = computed(() => {
  return JSON.stringify(featuredTeasers.value) !== featuredTeasersJson.value
})

const reinit = async () => {
  featureds.value = await loadFeatureds()
  featuredTeasers.value = await loadFeaturedTeasers()
  featuredTeasersJson.value = JSON.stringify(featuredTeasers.value)
}

const loadFeatureds = async () => {
  const responseData = await api.admin.getFeatureds()
  if ('error' in responseData) {
    console.error('Error loading featureds:', responseData.error)
    return null
  }
  return responseData
}

const loadFeaturedTeasers = async () => {
  const responseData = await api.admin.getFeaturedTeasers()
  if ('error' in responseData) {
    console.error('Error loading featureds:', responseData.error)

    const featuredTeasers: FeaturedTeaserRowFeaturedRow[] = featureds.value?.items.map((value, idx) => {
      return {
        id: 0,
        active: 0,
        featured_id: value.id,
        sort_index: idx,
        featured: value,
      }
    }) || []
    return { items: featuredTeasers }
  }

  const featuredTeasers: FeaturedTeaserRowFeaturedRow[] = featureds.value?.items.map((value) => {
    const item = responseData.items.find((item: FeaturedTeaserRow) => item.featured_id === value.id)
    return {
      id: item?.id || 0,
      active: item?.active || 0,
      featured_id: value.id,
      sort_index: item ? item.sort_index : Number.MAX_SAFE_INTEGER,
      featured: value,
    }
  }).filter(item => item.featured) || []
  // sort by sort_index
  featuredTeasers.sort((a, b) => {
    return a.sort_index < b.sort_index ? -1 : (a.sort_index > b.sort_index ? 1 : 0)
  })
  return { items: featuredTeasers }
}

const moveTeaser = (idx: number, direction: -1 | 1) => {
  if (!featuredTeasers.value) {
    return
  }
  featuredTeasers.value.items = arrayMove(featuredTeasers.value.items, idx, direction)
}

const onSaveClick = async () => {
  if (!featuredTeasers.value) {
    return
  }
  const teasers: FeaturedTeaserRow[] = featuredTeasers.value.items.map((item, idx) => ({
    id: item.id,
    active: item.active ? 1 : 0,
    featured_id: item.featured_id,
    sort_index: idx,
  }))
  await api.admin.saveFeaturedTeasers(teasers)
  await reinit()
}

onMounted(async () => {
  if (user.getMe()) {
    await reinit()
  }
  user.eventBus.on('login', async () => {
    await reinit()
  })
  user.eventBus.on('logout', async () => {
    await reinit()
  })
})
</script>
