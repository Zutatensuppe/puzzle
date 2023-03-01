<template>
  <div class="scores">
    <div>Scores</div>
    <table>
      <tr
        v-for="(p, idx) in actives"
        :key="idx"
        :style="playerStyle(p)"
      >
        <td><icon icon="lightning" /></td>
        <td>{{ p.name || '<No name>' }}</td>
        <td>{{ p.points }}</td>
      </tr>
      <tr
        v-for="(p, idx) in idles"
        :key="idx"
        :style="playerStyle(p)"
      >
        <td><icon icon="zzz" /></td>
        <td>{{ p.name || '<No name>' }}</td>
        <td>{{ p.points }}</td>
      </tr>
    </table>
  </div>
</template>
<script setup lang="ts">
import { computed, StyleValue } from 'vue'
import { Player } from '../../common/Types'

const props = defineProps<{
  players: {
    active: Player[],
    idle: Player[],
  },
}>()

const actives = computed((): Array<any> => {
  // TODO: dont sort in place
  props.players.active.sort((a: any, b: any) => b.points - a.points)
  return props.players.active
})

const idles = computed((): Array<any> => {
  // TODO: dont sort in place
  props.players.idle.sort((a: any, b: any) => b.points - a.points)
  return props.players.idle
})

const playerStyle = (p: Player) => {
  if (p.color === 'ukraine') {
    return {
      'backgroundImage': 'linear-gradient(180deg, rgba(0,87,183,1) 0%, rgba(0,87,183,1) 50%, rgba(255,221,0,1) 50%)',
      '-webkit-background-clip': 'text',
      '-webkit-text-fill-color': 'transparent',
    } as StyleValue
  }
  return { color: p.color } as StyleValue
}
</script>
