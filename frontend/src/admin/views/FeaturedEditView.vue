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
      <v-textarea
        v-model="featured.introduction"
        label="Introduction"
      />

      <h2>Links</h2>
      <div
        v-for="(link, idx) in featured.links"
        :key="idx"
      >
        <div class="d-flex gc-3">
          <v-text-field
            v-model="link.title"
            label="Title"
            density="compact"
          />
          <v-text-field
            v-model="link.url"
            label="Url"
            density="compact"
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

      <v-btn @click="featured.collections.push({id: 0, created: new Date(), name: 'New Collection', images: [] })">
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
import { CollectionRowWithImages, FeaturedId, FeaturedRowWithCollections } from '../../../../common/src/Types'
import { useRoute } from 'vue-router'
import CollectionEdit from '../components/CollectionEdit.vue'

const featured = ref<FeaturedRowWithCollections | null>(null)
const route = useRoute()

const load = async () => {
  const id = route.params.id as unknown as FeaturedId
  const res = await api.admin.getFeatured(id)
  featured.value = res.featured
}

const save = async () => {
  if (featured.value) {
    await api.admin.saveFeatured(featured.value)
    await load()
  }
}

const onDeleteCollection = (collection: CollectionRowWithImages) => {
  if (!featured.value) {
    return
  }
  featured.value.collections = featured.value?.collections.filter(c => c.id !== collection.id)
}

onMounted(async () => {
  if (user.getMe()) {
    await load()
  }
  user.eventBus.on('login', async () => {
    await load()
  })
  user.eventBus.on('logout', () => {
    featured.value = null
  })
})
</script>
