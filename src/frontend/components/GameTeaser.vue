<template>
  <v-card>
    <div class="game-teaser-inner" :style="style">
      <router-link class="game-info" :to="{ name: 'game', params: { id: game.id } }">
        <span class="game-info-text">
          <icon icon="puzzle-piece" /> {{game.piecesFinished}}/{{game.piecesTotal}}<br />
          <icon icon="sillouette" /> {{game.players}}<br />
          <icon icon="clock" v-if="!game.finished" />
          <icon icon="flag" v-else /> {{time(game.started, game.finished)}}<br />
        </span>
      </router-link>
      <router-link v-if="game.hasReplay" class="game-replay" :to="{ name: 'replay', params: { id: game.id } }">
        <icon icon="replay" /> Watch replay
      </router-link>
    </div>
  </v-card>
</template>
<script setup lang="ts">
import Time from './../../common/Time'
import { GameInfo } from './../../common/Types'

const props = defineProps<{
  game: GameInfo
}>()

const url = props.game.imageUrl.replace('uploads/', 'uploads/r/') + '-375x210.webp'
const style = { 'background-image': `url("${url}")` }

const time = (start: number, end: number) => {
  const from = start;
  const to = end || Time.timestamp()
  const timeDiffStr = Time.timeDiffStr(from, to)
  return `${timeDiffStr}`
}
</script>
