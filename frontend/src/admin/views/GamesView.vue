<template>
  <v-container>
    <Nav />
    <h1>Games</h1>
    <div v-if="serverInfo">
      {{ serverInfo.socketCount }} sockets connected
    </div>
    <Pagination
      v-if="games"
      :pagination="games.pagination"
      @click="onPagination"
    />
    <v-table
      v-if="games"
      density="compact"
    >
      <thead>
        <tr>
          <th>Preview</th>
          <th>Players</th>
          <th>Infos</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <GamesRow
          v-for="game in games.items"
          :key="game.id"
          :game="game"
          :server-info="serverInfo"
          @delete="onDelete"
          @fix-pieces="onFixPieces"
        />
      </tbody>
    </v-table>
    <Pagination
      v-if="games"
      :pagination="games.pagination"
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
import type { GameRowWithImageAndUser, Pagination as PaginationType, ServerInfo } from '../../../../common/src/Types'
import GamesRow from '../components/GamesRow.vue'

const perPage = 50
const games = ref<{ items: GameRowWithImageAndUser[], pagination: PaginationType } | null>(null)
const serverInfo = ref<ServerInfo | null>(null)

const onDelete = async (game: GameRowWithImageAndUser) => {
  if (!confirm(`Really delete game ${game.id}?`)) {
    return
  }

  const resp = await api.admin.deleteGame(game.id)
  if (resp.ok) {
    if (games.value) {
      games.value.items = games.value.items.filter(g => g.id !== game.id)
    }
    alert('Successfully deleted game!')
  } else {
    alert('Deleting game failed!')
  }
}

const onFixPieces = async (game: GameRowWithImageAndUser) => {
  const resp = await api.admin.fixPieces(game.id)
  if (resp.ok) {
    alert('Successfully fixed ' + resp.changed + 'pieces!')
  } else {
    alert('Fixing pieces failed! ' + resp.error)
  }
}

const loadGames = async (data: { limit: number; offset: number }) => {
  const responseData = await api.admin.getGames(data)
  if ('error' in responseData) {
    console.error('Error loading games:', responseData.error)
    return null
  }
  return responseData
}

const onPagination = async (q: { limit: number, offset: number }) => {
  if (!games.value) {
    return
  }
  games.value = await loadGames(q)
}

onMounted(async () => {
  if (user.getMe()) {
    games.value = await loadGames({ limit: perPage, offset: 0 })
    serverInfo.value = await api.admin.getServerInfo()
  }
  user.eventBus.on('login', async () => {
    games.value = await loadGames({ limit: perPage, offset: 0 })
    serverInfo.value = await api.admin.getServerInfo()
  })
  user.eventBus.on('logout', () => {
    games.value = null
    serverInfo.value = null
  })
})
</script>
