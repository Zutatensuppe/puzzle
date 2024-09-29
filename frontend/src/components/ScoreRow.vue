<template>
  <tr :style="style">
    <td>
      <icon
        :style="iconStyle"
        :title="iconTitle"
      />
    </td>
    <td class="pl-1">
      {{ name }}
    </td>
    <td class="pl-1">
      {{ points }}
    </td>
  </tr>
</template>
<script setup lang="ts">
import { StyleValue, computed } from 'vue'
import { BasicPlayerInfo, RegisteredMap } from '../../../common/src/Types'
import { GameInterface } from '../Game'

const props = defineProps<{
  player: BasicPlayerInfo,
  active: boolean,
  registeredMap: RegisteredMap,
  game: GameInterface,
}>()

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


let badgeMap: Record<string, string> = {}
const getColoredBadge = (color: string): string => {
  const graphics = props.game.getGraphics()
  const assets = props.game.getAssets()
  let url = ''
  let key = 'color_' + color + '_' + (props.active ? 'active' : 'idle')
  if (key in badgeMap) {
    url = badgeMap[key]
  } else {
    if (props.active) {
      badgeMap[key] = graphics.colorizedCanvas(assets.Gfx.badgeOver, assets.Gfx.badgeMask, props.player.color || '#ffffff').toDataURL()
    } else {
      badgeMap[key] = graphics.colorizedCanvas(assets.Gfx.badgeOverIdle, assets.Gfx.badgeMask, props.player.color || '#ffffff').toDataURL()
    }
    url = badgeMap[key]
  }
  return url
}

const getAnonBadge = (): string => {
  const graphics = props.game.getGraphics()
  const assets = props.game.getAssets()
  let url = ''
  let key = 'anon_' + (props.active ? 'active' : 'idle')
  if (key in badgeMap) {
    url = badgeMap[key]
  } else {
    if (props.active) {
      badgeMap[key] = graphics.bitmapToImageString(assets.Gfx.badgeAnon)
    } else {
      badgeMap[key] = graphics.bitmapToImageString(assets.Gfx.badgeAnonIdle)
    }
    url = badgeMap[key]
  }
  return url
}

const iconStyle = computed(() => {
  const url = !props.registeredMap[props.player.id]
    ? getAnonBadge()
    : getColoredBadge(props.player.color || '#ffffff')
  return {
    backgroundImage: `url(${url})`,
  }
})

const iconTitle = computed(() => {
  const active = (props.active ? 'Active' : 'Idle')
  if (!props.registeredMap[props.player.id]) {
    return active + ', anonymous user'
  }
  return active + ', registered user ♥'
})
</script>
