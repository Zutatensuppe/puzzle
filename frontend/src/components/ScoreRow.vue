<template>
  <tr
    v-if="showPlayer"
    :style
  >
    <td>
      <icon
        :style="iconStyle"
        :title="iconTitle"
      />
    </td>
    <td class="pl-1">
      <s
        v-if="player.banned"
        :title="name"
      >[banned]</s>
      <router-link
        v-else-if="registeredMap[player.id]"
        :to="{ name: 'user', params: { id: registeredMap[player.id] } }"
        target="_blank"
        :style
      >
        {{ name }}
      </router-link>
      <span
        v-else
      >{{ name }}</span>
    </td>
    <td class="pl-1">
      {{ points }}
    </td>
    <td v-if="showAdminActions">
      <Icon
        v-if="!player.banned && !isCreator"
        icon="boot"
        class="is-clickable"
        title="Ban this player"
        @click="() => emit('ban', props.player.id)"
      />
      <Icon
        v-if="player.banned && !isCreator"
        icon="angel"
        class="is-clickable"
        title="Unban this player"
        @click="() => emit('unban', props.player.id)"
      />
    </td>
  </tr>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import type { StyleValue } from 'vue'
import type { BasicPlayerInfoWithBannedAndActive, ClientId, RegisteredMap } from '@common/Types'
import type { GameInterface } from '../Game'
import { getAnonBadge, getColoredBadge } from '../BadgeCreator'
import Icon from './Icon.vue'

const props = defineProps<{
  player: BasicPlayerInfoWithBannedAndActive,
  registeredMap: RegisteredMap,
  game: GameInterface,
  showAdminActions: boolean,
}>()

const isCreator = computed(() => props.game.getClientId() === props.player.id)

const emit = defineEmits<{
  (e: 'ban', p: ClientId): void
  (e: 'unban', p: ClientId): void
}>()

const showPlayer = computed(() => {
  if (props.showAdminActions) {
    return true
  }
  return props.player.points > 0 || props.player.active
})

const name = computed(() => {
  return props.player.name || '<No name>'
})
const points = computed(() => {
  return props.player.points
})

const style = computed(() => {
  if (props.player.color === 'ukraine') {
    return {
      'backgroundImage': 'linear-gradient(180deg, rgba(0,87,183,1) 0%, rgba(0,87,183,1) 50%, rgba(255,221,0,1) 50%)',
      '-webkit-background-clip': 'text',
      '-webkit-text-fill-color': 'transparent',
    } as StyleValue
  }
  return { color: props.player.color || '#ffffff' }
})

const iconStyle = computed(() => {
  const url = !props.registeredMap[props.player.id]
    ? getAnonBadge(props.game.assets, props.player.active)
    : getColoredBadge(props.game.graphics, props.game.assets, props.player.color || '#ffffff', props.player.active)
  return {
    backgroundImage: `url(${url})`,
  }
})

const iconTitle = computed(() => {
  if (props.player.banned) {
    return 'Banned in this puzzle'
  }
  const active = (props.player.active ? 'Active' : 'Idle')
  if (!props.registeredMap[props.player.id]) {
    return active + ', anonymous user'
  }
  return active + ', registered user ♥'
})
</script>
