"use strict"

// ingame component
// shows player scores

export default {
  name: "scores",
  template: `
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
  `,
  computed: {
    actives () {
      // TODO: dont sort in place
      this.activePlayers.sort((a, b) => b.points - a.points)
      return this.activePlayers
    },
    idles () {
      // TODO: dont sort in place
      this.idlePlayers.sort((a, b) => b.points - a.points)
      return this.idlePlayers
    },
  },
  props: {
    activePlayers: Array,
    idlePlayers: Array,
  },
}
