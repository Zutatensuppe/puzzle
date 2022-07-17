<template>
  <div>
    <Nav />
    GAMES
    <table class="data-table">
      <tr>
        <th>Id</th>
        <th>Creator</th>
        <th>Image</th>
        <th>Created</th>
        <th>Finished</th>
        <th>Private</th>
        <th>Data</th>
      </tr>
      <tr v-for="(item, idx) in games" :key="idx">
        <td>{{item.id}}</td>
        <td>{{item.creator_user_id || '-'}}</td>
        <td>{{item.image_id}}</td>
        <td>{{item.created}}</td>
        <td>{{item.finished}}</td>
        <td>{{item.private ? '✓' : '✖'}}</td>
        <td>{{item.data}}</td>
      </tr>
    </table>
  </div>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import user from '../../user';
import { getGames } from '../api';
import Nav from '../components/Nav.vue'

const games = ref<any[]>([])

onMounted(async () => {
  if (user.getMe()?.loggedIn) {
    games.value = await getGames()
  }
  user.eventBus.on('login', async () => {
    games.value = await getGames()
  })
  user.eventBus.on('logout', () => {
    games.value = []
  })
})
</script>
