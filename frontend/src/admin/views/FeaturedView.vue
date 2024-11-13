<template>
  <v-container>
    <Nav />
    <h1>Featured</h1>
    <div>
      <v-select
        v-model="type"
        :items="['artist', 'category']"
        label="Type"
      />
      <v-text-field
        v-model="name"
        label="Name"
      />
      <v-textarea
        v-model="introduction"
        label="Introduction"
      />
      <v-btn @click="create">
        Create
      </v-btn>
    </div>

    <Pagination
      v-if="featureds"
      :pagination="featureds.pagination"
      @click="onPagination"
    />
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
    <Pagination
      v-if="featureds"
      :pagination="featureds.pagination"
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
import { FeaturedRow, Pagination as PaginationType } from '../../../../common/src/Types'

const perPage = 50
const featureds = ref<{ items: FeaturedRow[], pagination: PaginationType } | null>(null)

const type = ref<'artist' | 'category'>('artist')
const name = ref<string>('')
const introduction = ref<string>('')
const create = async () => {
  await api.admin.createFeatured(
    type.value,
    name.value,
    introduction.value,
    [],
  )
  featureds.value = await api.admin.getFeatureds({ limit: perPage, offset: 0 })
}


const onPagination = async (q: { limit: number, offset: number }) => {
  if (!featureds.value) {
    return
  }
  featureds.value = await api.admin.getFeatureds(q)
}

onMounted(async () => {
  if (user.getMe()) {
    featureds.value = await api.admin.getFeatureds({ limit: perPage, offset: 0 })
  }
  user.eventBus.on('login', async () => {
    featureds.value = await api.admin.getFeatureds({ limit: perPage, offset: 0 })
  })
  user.eventBus.on('logout', () => {
    featureds.value = null
  })
})
</script>
