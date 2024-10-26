<template>
  <div class="scores">
    <div>Scores</div>
    <table>
      <ScoreRow
        v-for="(p, idx) in actives"
        :key="idx"
        :player="p"
        :active="true"
        :registered-map="registeredMap"
        :game="game"
      />
      <ScoreRow
        v-for="(p, idx) in idles"
        :key="idx"
        :player="p"
        :active="false"
        :registered-map="registeredMap"
        :game="game"
      />
    </table>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { BasicPlayerInfo, RegisteredMap, GamePlayers } from '../../../common/src/Types'
import ScoreRow from './ScoreRow.vue'
import sortBy from 'lodash/sortBy'
import { GameInterface } from '../Game'

const props = defineProps<{
  players: GamePlayers,
  registeredMap: RegisteredMap,
  game: GameInterface
}>()

const actives = computed((): BasicPlayerInfo[] => sortBy(props.players.active, (p: BasicPlayerInfo) => -p.points))
const idles = computed((): BasicPlayerInfo[] => sortBy(props.players.idle, (p: BasicPlayerInfo) => -p.points))
</script>
