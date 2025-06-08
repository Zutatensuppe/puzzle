<template>
  <v-container>
    <Nav />
    <h1>Featured</h1>
    <div v-if="featured">
      <v-select
        v-model="featured.type"
        :items="['artist', 'category']"
        label="Type"
      />
      <v-text-field
        v-model="featured.name"
        label="Name"
      />
      <v-text-field
        v-model="featured.slug"
        label="Slug"
      />
      <v-textarea
        v-model="featured.introduction"
        label="Introduction"
      />

      <h2>Links</h2>
      <div
        v-for="(link, idx) in featured.links"
        :key="idx"
      >
        <div class="d-flex gc-3 mb-3 align-center">
          <span class="is-clickable" @click="moveLink(idx, -1)">▲</span>
          <span class="is-clickable" @click="moveLink(idx, +1)">▼</span>
          <v-text-field
            v-model="link.title"
            label="Title"
            density="compact"
            :hide-details="true"
          />
          <v-text-field
            v-model="link.url"
            label="Url"
            density="compact"
            :hide-details="true"
          />
          <v-btn @click="featured.links = featured.links.filter((_, i) => i !== idx)">
            Delete
          </v-btn>
        </div>
      </div>
      <v-btn @click="featured.links.push({url: '', title: ''})">
        Add Link
      </v-btn>

      <h2>Collections</h2>
      <CollectionEdit
        v-for="(collection, idx) in featured.collections"
        :key="idx"
        v-model="featured.collections[idx]"
        @delete="onDeleteCollection(collection)"
      />

      <v-btn @click="featured.collections.push({id: 0, created: JSON.stringify(new Date()), name: 'New Collection', images: [] })">
        Add Collection
      </v-btn>

      <hr class="ma-4">

      <div>
        <v-btn @click="save">
          Save
        </v-btn>
      </div>
    </div>
  </v-container>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import user from '../../user'
import api from '../../_api'
import Nav from '../components/Nav.vue'
import type { CollectionRowWithImages, FeaturedId, FeaturedRowWithCollections } from '../../../../common/src/Types'
import { useRoute, useRouter } from 'vue-router'
import CollectionEdit from '../components/CollectionEdit.vue'
import { arrayMove } from '../../../../common/src/Util'

const featured = ref<FeaturedRowWithCollections | null>(null)
const route = useRoute()
const router = useRouter()

const load = async () => {
  const id = parseInt(String(route.params.id), 10) as FeaturedId
  if (isNaN(id) || id === 0) {
    // creating a new featured entry
    return {
      id: 0 as FeaturedId,
      created: JSON.stringify(new Date()),
      name: '',
      slug: '',
      type: 'artist',
      introduction: '',
      links: [],
      collections: []
    } as FeaturedRowWithCollections
  }
  const responseData = await api.admin.getFeatured(id)
  if ('error' in responseData) {
    console.error('Error loading featured:', responseData.error)
    return null
  }
  return responseData.featured
}

const save = async () => {
  if (!featured.value) {
    return
  }

  if (!featured.value.id) {
    // new entry needs to be created (and updated)
    // no id exists yet, so after creation we also update the route
    const result = await api.admin.createFeatured(featured.value)
    if ('reason' in result) {
      console.error('Error creating featured:', result.reason)
      return
    }
    featured.value.id = result.featured.id
    await api.admin.saveFeatured(featured.value)
    router.push({ name: 'admin_featured_edit', params: { id: featured.value.id } })
    return
  }

  await api.admin.saveFeatured(featured.value)
  featured.value = await load()
}

const moveLink = (idx: number, direction: -1 | 1) => {
  if (!featured.value) {
    return
  }

  featured.value.links = arrayMove(featured.value.links, idx, direction)
}

const onDeleteCollection = (collection: CollectionRowWithImages) => {
  if (!featured.value) {
    return
  }
  featured.value.collections = featured.value?.collections.filter(c => c.id !== collection.id)
}

onMounted(async () => {
  if (user.getMe()) {
    featured.value = await load()
  }
  user.eventBus.on('login', async () => {
    featured.value = await load()
  })
  user.eventBus.on('logout', () => {
    featured.value = null
  })
})
</script>
