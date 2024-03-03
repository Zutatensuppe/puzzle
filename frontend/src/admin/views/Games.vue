<template>
  <v-container>
    <Nav />
    <h1>Games</h1>
    <v-table density="compact">
      <thead>
        <tr>
          <th>Preview</th>
          <th>Infos</th>

          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(item, idx) in games"
          :key="idx"
        >
          <th>
            <a
              :href="`/uploads/${item.image.filename}`"
              target="_blank"
            ><img :src="resizeUrl(`/image-service/image/${item.image.filename}`, 150, 100, 'contain')">
            </a>
          </th>
          <td>
            <div class="d-flex ga-3">
              <span class="text-disabled">Id:</span> <a
                :href="`/g/${item.id}`"
                target="_blank"
              >{{ item.id }}</a>
              <span class="text-disabled">Image-Id: </span> {{ item.image_id }}
              <span class="text-disabled">Private:</span> {{ item.private ? true : false }}
            </div>
            <div class="d-flex ga-3">
              <span class="text-disabled">Creator:</span> {{ item.creator_user_id || '-' }}
              <span class="text-disabled">Created:</span> {{ item.created }}
              <span class="text-disabled">Finished:</span> {{ item.finished || '-' }}
            </div>
            <div class="d-flex ga-3">
              <span class="text-disabled">Pieces:</span> {{ item.pieces_count }}
              <span class="text-disabled">Game Version:</span> {{ gameVersion(item) }}
              <span class="text-disabled">Has Replay:</span> {{ gameHasReplay(item) }}
              <span class="text-disabled">Score Mode:</span> {{ gameScoreMode(item) }}
              <span class="text-disabled">Shape Mode:</span> {{ gameShapeMode(item) }}
              <span class="text-disabled">Snap Mode:</span> {{ gameSnapMode(item) }}
            </div>
            <div class="d-flex ga-3" />
          </td>

          <td>
            <span
              class="is-clickable"
              @click="onDelete(item)"
            >DELETE</span>
          </td>
        </tr>
      </tbody>
    </v-table>
  </v-container>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { resizeUrl } from '../../../../common/src/ImageService'
import user from '../../user'
import api from '../../_api'
import Nav from '../components/Nav.vue'
import { scoreModeToString, shapeModeToString, snapModeToString } from '../../../../common/src/Util'

const games = ref<any[]>([])

const gameVersion = (game: any) => {
  const parsed = JSON.parse(game.data)
  return parsed.gameVersion || '-'
}
const gameHasReplay = (game: any) => {
  const parsed = JSON.parse(game.data)
  return parsed.hasReplay || '-'
}
const gameScoreMode = (game: any) => {
  const parsed = JSON.parse(game.data)
  return snapModeToString(parsed.scoreMode)
}
const gameShapeMode = (game: any) => {
  const parsed = JSON.parse(game.data)
  return scoreModeToString(parsed.shapeMode)
}
const gameSnapMode = (game: any) => {
  const parsed = JSON.parse(game.data)
  return shapeModeToString(parsed.snapMode)
}

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
