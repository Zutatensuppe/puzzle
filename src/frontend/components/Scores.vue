<template>
  <div class="scores">
    <div>Scores</div>
    <table>
      <tr v-for="(p, idx) in actives" :key="idx" :style="{color: p.color}">
        <td>⚡</td>
        <td>{{p.name}}</td>
        <td>{{p.points}}</td>
      </tr>
      <tr v-for="(p, idx) in idles" :key="idx" :style="{color: p.color}">
        <td>💤</td>
        <td>{{p.name}}</td>
        <td>{{p.points}}</td>
      </tr>
    </table>
  </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  name: "scores",
  props: {
    activePlayers: {
      type: Array,
      required: true,
    },
    idlePlayers: {
      type: Array,
      required: true,
    },
  },
  computed: {
    actives (): Array<any> {
      // TODO: dont sort in place
      this.activePlayers.sort((a: any, b: any) => b.points - a.points)
      return this.activePlayers
    },
    idles (): Array<any> {
      // TODO: dont sort in place
      this.idlePlayers.sort((a: any, b: any) => b.points - a.points)
      return this.idlePlayers
    },
  },
})
</script>
