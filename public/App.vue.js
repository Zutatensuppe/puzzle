export default {
  name: 'app',
  template: `
  <div id="app">
    <ul class="nav" v-if="showNav">
      <li><router-link class="btn" :to="{name: 'index'}">Index</router-link></li>
      <li><router-link class="btn" :to="{name: 'new-game'}">New game</router-link></li>
    </ul>

    <router-view />
  </div>`,
  computed: {
    showNav () {
      // TODO: add info wether to show nav to route props
      return !['game', 'replay'].includes(this.$route.name)
    },
  },
}
