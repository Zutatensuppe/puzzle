<template>
  <div>
    <Nav />
    IMAGES
    <table class="data-table">
      <tr>
        <th>Id</th>
        <th>Uploader</th>
        <th>Created</th>
        <th>Filename</th>
        <th>Filename Original</th>
        <th>Title</th>
        <th>Width</th>
        <th>Height</th>
        <th>Private</th>
      </tr>
      <tr v-for="(item, idx) in images" :key="idx">
        <td>{{item.id}}</td>
        <td>{{item.uploader_user_id || '-'}}</td>
        <td>{{item.created}}</td>
        <td>{{item.filename}}</td>
        <td>{{item.filename_original}}</td>
        <td>{{item.title}}</td>
        <td>{{item.width}}</td>
        <td>{{item.height}}</td>
        <td>{{item.private ? '✓' : '✖'}}</td>
      </tr>
    </table>
  </div>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import user from '../../user';
import { getImages } from '../api';
import Nav from '../components/Nav.vue'

const images = ref<any[]>([])

onMounted(async () => {
  if (user.getMe()) {
    images.value = await getImages()
  }
  user.eventBus.on('login', async () => {
    images.value = await getImages()
  })
  user.eventBus.on('logout', () => {
    images.value = []
  })
})
</script>
