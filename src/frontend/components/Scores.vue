<template>
  <div class="scores">
    <div>Scores</div>
    <table>
      <tr v-for="(p, idx) in actives" :key="idx" :style="playerStyle(p)">
        <td><i class="icon icon-lightning" /></td>
        <td>{{p.name}}</td>
        <td>{{p.points}}</td>
      </tr>
      <tr v-for="(p, idx) in idles" :key="idx" :style="playerStyle(p)">
        <td><i class="icon icon-zzz" /></td>
        <td>{{p.name}}</td>
        <td>{{p.points}}</td>
      </tr>
    </table>
  </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  props: {
    players: {
      type: Object,
      required: true,
    },
  },
  methods: {
    playerStyle(p: any) {
      if (p.color === 'ukraine') {
        return {
          'backgroundImage': 'linear-gradient(180deg, rgba(0,87,183,1) 0%, rgba(0,87,183,1) 50%, rgba(255,221,0,1) 50%)',
          '-webkit-background-clip': 'text',
          '-webkit-text-fill-color': 'transparent',
        }
      } else {
        return {color: p.color}
      }
    },
  },
  computed: {
    actives (): Array<any> {
      // TODO: dont sort in place
      this.players.active.sort((a: any, b: any) => b.points - a.points)
      return this.players.active
    },
    idles (): Array<any> {
      // TODO: dont sort in place
      this.players.idle.sort((a: any, b: any) => b.points - a.points)
      return this.players.idle
    },
  },
})
</script>
