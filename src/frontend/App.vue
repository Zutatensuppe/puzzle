<template>
  <div id="app">
    <ul class="nav" v-if="showNav">
      <li><router-link class="btn" :to="{name: 'index'}">Index</router-link></li>
      <li><router-link class="btn" :to="{name: 'new-game'}">New game</router-link></li>
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
