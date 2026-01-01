<template>
  <div class="scores">
    <div>Scores</div>
    <table>
      <ScoreRow
        v-for="(p, idx) in allPlayers"
        :key="idx"
        :player="p"
        :registered-map="registeredMap"
        :game="game"
        :show-admin-actions="isGameOwner"
        @ban="banPlayer"
        @unban="unbanPlayer"
      />
    </table>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import type { BasicPlayerInfo, RegisteredMap, GamePlayers, BasicPlayerInfoWithBannedAndActive, ClientId } from '@common/Types'
import ScoreRow from './ScoreRow.vue'
import sortBy from 'lodash/sortBy'
import type { GameInterface } from '../Game'

import { me } from '../user'
import GameCommon from '@common/GameCommon'

const props = defineProps<{
  players: GamePlayers,
  registeredMap: RegisteredMap,
  game: GameInterface
}>()

const allPlayers = computed((): BasicPlayerInfoWithBannedAndActive[] => {
  // active and idle may include banned, if they have points they are shown(maybe as 'BANNED' ?)
  // active high points to low points
  // idle high points to low points

  // banned (any order)

  const active = sortBy(props.players.active, (p: BasicPlayerInfo) => -p.points)
    .map(p => ({ ...p, active: true, banned: props.players.banned.some(b => b.id === p.id) }))
    .filter(p => !p.banned || p.points > 0)
  const idle = sortBy(props.players.idle, (p: BasicPlayerInfo) => -p.points)
    .map(p => ({ ...p, active: false, banned: props.players.banned.some(b => b.id === p.id) }))
    .filter(p => !p.banned || p.points > 0)
  const banned = sortBy(props.players.banned, (p: BasicPlayerInfo) => -p.points)
    .map(p => ({ ...p, active: false, banned: true }))
    .filter(p => !active.some(a => a.id === p.id) && !idle.some(i => i.id === p.id))

  return [
    ...active,
    ...idle,
    ...banned,
  ]
})

const emit = defineEmits<{
  (e: 'ban', p: ClientId): void
  (e: 'unban', p: ClientId): void
}>()

const banPlayer = (p: ClientId) => {
  emit('ban', p)
}
const unbanPlayer = (p: ClientId) => {
  emit('unban', p)
}

const isGameOwner = computed<boolean>(() => !!(me.value && me.value.id === GameCommon.getCreatorUserId(props.game.getGameId())))
</script>
