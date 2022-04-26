<template>
  <div id="app">
    <ul class="nav" v-if="showNav">
      <li><router-link class="btn" :to="{name: 'index'}">Games overview</router-link></li>
      <li><router-link class="btn" :to="{name: 'new-game'}">New game</router-link></li>
      <li><a href="https://stand-with-ukraine.pp.ua/" class="btn btn-ukraine" target="_blank">
        <i class="icon icon-ukraine-heart" /> Stand with Ukraine <i class="icon icon-ukraine-heart" /></a></li>
    </ul>

    <router-view />
  </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'app',
  computed: {
    showNav () {
      // TODO: add info wether to show nav to route props
      return !['game', 'replay'].includes(String(this.$route.name))
    },
  },
})
</script>
