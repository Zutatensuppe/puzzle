<template>
  <tr>
    <td>
      <a
        v-if="game.image"
        :href="`/uploads/${game.image.filename}`"
        target="_blank"
        class="image-holder"
      ><img
        :src="resizeUrl(`/image-service/image/${game.image.filename}`, 150, 100, 'contain')"
        :class="game.image.private ? ['image-private', 'image'] : ['image']"
      ></a>
    </td>
    <td valign="top">
      <div>
        <div v-if="serverInfo?.gameLogInfoByGameIds[game.id] && (serverInfo?.gameLogInfoByGameIds[game.id].logEntriesToFlush || 0) > 0">
          📓 {{ (serverInfo?.gameLogInfoByGameIds[game.id].logEntriesToFlush || 0) }} log <span v-if="(serverInfo?.gameLogInfoByGameIds[game.id].logEntriesToFlush || 0) > 1">entries</span><span v-else>entry</span> to flush
        </div>
        <div v-if="(serverInfo?.socketCountsByGameIds[game.id] || 0) > 0">
          🔴 {{ (serverInfo?.socketCountsByGameIds[game.id] || 0) }} player<span v-if="(serverInfo?.socketCountsByGameIds[game.id] || 0) > 1">s</span> connected
        </div>
        <div v-else>
          No players connected
        </div>
        <hr>
        <div style="height: 100px; overflow-y: auto;">
          <div
            v-for="player in sortedPlayers(game)"
            :key="`${game.id}-${player[0]}`"
          >
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
      <div class="d-flex flex-wrap gc-3">
        <span class="text-disabled">Id:</span> <a
          :href="`/g/${game.id}`"
          target="_blank"
        >{{ game.id }}</a>
        <span class="text-disabled">Image-Id: </span> {{ game.image_id }}
        <span class="text-disabled">Private:</span> <span :class="{ 'color-private': game.private }">{{ game.private ? '✓' : '✖' }}</span>
        <span class="text-disabled">Password:</span>
        <Icon
          v-if="game.join_password"
          icon="lock-closed"
          title="Password protected"
        />
        <span v-else>-</span>
        <span class="text-disabled">Anon:</span>
        <Icon
          v-if="game.require_account"
          icon="no-anon"
          title="No anonymous players allowed"
        />
        <span v-else>✓</span>
      </div>
      <div class="d-flex flex-wrap gc-3">
        <span class="text-disabled">Creator:</span>
        <span v-if="game.creator_user_id">
          {{ game.creator_user_id }} <span v-if="game.user?.name">({{ game.user.name }})</span>
        </span>
        <span v-else>Unknown</span>
        <span class="text-disabled">Created:</span> {{ game.created }}
        <span class="text-disabled">Finished:</span> <span :class="{ 'color-finished': game.finished }">{{ game.finished || '-' }}</span>
      </div>
      <div class="d-flex flex-wrap gc-3">
        <span class="text-disabled">Pieces:</span> {{ game.pieces_count }}
        <span class="text-disabled">Game Version:</span> {{ gameVersion }}
        <Icon
          :icon="replayIcon"
          :title="gameHasReplay"
        />
        <Icon
          :icon="scoreIcon"
          :title="gameScoreMode"
        />
        <Icon
          :icon="shapeIcon"
          :title="gameShapeMode"
        />
        <Icon
          :icon="snapIcon"
          :title="gameSnapMode"
        />
        <Icon
          :icon="rotationIcon"
          :title="gameRotationMode"
        />
      </div>
    </td>

    <td>
      <v-btn
        block
        @click="onDelete()"
      >
        DELETE
      </v-btn>
      <br>
      <v-btn
        block
        @click="fixPieces()"
      >
        Fix Pieces
      </v-btn>
    </td>
  </tr>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { resizeUrl } from '../../../../common/src/ImageService'
import { rotationModeToString, scoreModeToString, shapeModeToString, snapModeToString } from '../../../../common/src/Util'
import { EncodedPlayer, EncodedPlayerIdx, GameRowWithImageAndUser, ServerInfo } from '../../../../common/src/Types'
import Icon from '../../components/Icon.vue'

const props = defineProps<{
  game: GameRowWithImageAndUser
  serverInfo: ServerInfo | null
}>()

const emit = defineEmits<{
  (e: 'delete', game: GameRowWithImageAndUser): void
  (e: 'fixPieces', game: GameRowWithImageAndUser): void
}>()

const gameData = computed(() => JSON.parse(props.game.data))
const gameVersion = computed(() => gameData.value.gameVersion || '-')
const gameHasReplay = computed(() => gameData.value.hasReplay ? 'Replay exists' : 'No Replay')
const replayIcon = computed(() => gameData.value.hasReplay ? 'film-camera' : 'no-film-camera')
const gameScoreMode = computed(() => 'Scoring: ' + scoreModeToString(gameData.value.scoreMode))
const scoreIcon = computed(() => 'score-' + scoreModeToString(gameData.value.scoreMode).toLowerCase())
const gameShapeMode = computed(() => 'Shapes: ' + shapeModeToString(gameData.value.shapeMode))
const shapeIcon = computed(() => 'puzzle-piece-' + shapeModeToString(gameData.value.shapeMode).toLowerCase())
const gameSnapMode = computed(() => 'Snapping: ' + snapModeToString(gameData.value.snapMode))
const snapIcon = computed(() => 'snap-' + snapModeToString(gameData.value.snapMode).toLowerCase())
const gameRotationMode = computed(() => 'Rotation: ' + rotationModeToString(gameData.value.rotationMode))
const rotationIcon = computed(() => 'rotation-' + rotationModeToString(gameData.value.rotationMode).toLowerCase())
const sortedPlayers = computed(() => gameData.value.players.toSorted((a: EncodedPlayer, b: EncodedPlayer) => b[EncodedPlayerIdx.POINTS] - a[EncodedPlayerIdx.POINTS]))

const onDelete = () => {
  emit('delete', props.game)
}

const fixPieces = () => {
  emit('fixPieces', props.game)
}
</script>
