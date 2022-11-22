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

        <th>Actions</th>
      </tr>
      <tr v-for="(item, idx) in games" :key="idx">
        <td>{{item.id}}</td>
        <td>{{item.creator_user_id || '-'}}</td>
        <td>{{item.image_id}}</td>
        <td>{{item.created}}</td>
        <td>{{item.finished}}</td>
        <td>{{item.private ? '✓' : '✖'}}</td>

        <td><span @click="onDelete(item)" class="is-clickable">DELETE</span></td>
      </tr>
    </table>
  </div>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import user from '../../user';
import api from '../../_api';
import Nav from '../components/Nav.vue'

const games = ref<any[]>([])

const onDelete = async (game: any) => {
  if (!confirm(`Really delete game ${game.id}?`)) {
    return
  }

  const resp = await api.admin.deleteGame(game.id)
  if (resp.ok) {
    games.value = games.value.filter(g => g.id !== game.id)
    alert('Successfully deleted game!')
  } else {
    alert('Deleting game failed!')
  }
}

onMounted(async () => {
  if (user.getMe()) {
    games.value = await api.admin.getGames()
  }
  user.eventBus.on('login', async () => {
    games.value = await api.admin.getGames()
  })
  user.eventBus.on('logout', () => {
    games.value = []
  })
})
</script>
