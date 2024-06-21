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
    <v-table density="compact" v-if="games">
      <thead>
        <tr>
          <th>Preview</th>
          <th>Players</th>
          <th>Infos</th>

          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="item in games.items"
          :key="item.id"
        >
          <td>
            <a
              :href="`/uploads/${item.image.filename}`"
              target="_blank"
            ><img :src="resizeUrl(`/image-service/image/${item.image.filename}`, 150, 100, 'contain')">
            </a>
          </td>
          <td valign="top">
            <div>
              <div v-if="(serverInfo?.socketCountsByGameIds[item.id] || 0) > 0">
                🔴 {{ (serverInfo?.socketCountsByGameIds[item.id] || 0) }} player<span v-if="(serverInfo?.socketCountsByGameIds[item.id] || 0) > 1">s</span> connected
              </div>
              <div v-else>
                No players connected
              </div>
              <hr />
              <div style="height: 100px; overflow-y: auto;">
                <div v-for="player in sortedPlayers(item)">
                  <div
                    :style="player[5] === 'ukraine' ? {
                      'backgroundImage': 'linear-gradient(180deg, rgba(0,87,183,1) 0%, rgba(0,87,183,1) 50%, rgba(255,221,0,1) 50%)',
                      '-webkit-background-clip': 'text',
                      '-webkit-text-fill-color': 'transparent'
                    } : { color: player[5] }"
                  >
                    {{ player[4] }} ({{ player[7] }})
                  </div>
                </div>
              </div>
            </div>
          </td>
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
            <v-btn
              block
              @click="onDelete(item)"
            >
              DELETE
            </v-btn>
            <br />
            <v-btn
              block
              @click="fixPieces(item.id)"
            >
              Fix Pieces
            </v-btn>
          </td>
        </tr>
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
import { resizeUrl } from '../../../../common/src/ImageService'
import user from '../../user'
import api from '../../_api'
import Nav from '../components/Nav.vue'
import Pagination from '../../components/Pagination.vue'
import { scoreModeToString, shapeModeToString, snapModeToString } from '../../../../common/src/Util'
import { GameId, Pagination as PaginationType, ServerInfo } from '../../../../common/src/Types'

const perPage = 50
const games = ref<{ items: any[], pagination: PaginationType } | null>(null)
const serverInfo = ref<ServerInfo | null>(null)

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
    if (games.value) {
      games.value.items = games.value.items.filter(g => g.id !== game.id)
    }
    alert('Successfully deleted game!')
  } else {
    alert('Deleting game failed!')
  }
}

const fixPieces = async (gameId: GameId) => {
  const resp = await api.admin.fixPieces(gameId)
  if (resp.ok) {
    alert('Successfully fixed ' + resp.changed + 'pieces!')
  } else {
    alert('Fixing pieces failed! ' + resp.error)
  }
}

const sortedPlayers = (item: any) => {
  const parsed = JSON.parse(item.data).players
  // sort by score descending
  parsed.sort((a: any, b: any) => {
    return b[7] - a[7]
  })
  return parsed
}

const onPagination = async (q: { limit: number, offset: number }) => {
  if (!games.value) {
    return
  }
  games.value = await api.admin.getGames(q)
}

onMounted(async () => {
  if (user.getMe()) {
    games.value = await api.admin.getGames({ limit: perPage, offset: 0 })
    serverInfo.value = await api.admin.getServerInfo()
  }
  user.eventBus.on('login', async () => {
    games.value = await api.admin.getGames({ limit: perPage, offset: 0 })
    serverInfo.value = await api.admin.getServerInfo()
  })
  user.eventBus.on('logout', () => {
    games.value = null
    serverInfo.value = null
  })
})
</script>
