<template>
  <ul class="nav" v-if="showNav">
    <li><router-link class="btn" :to="{name: 'index'}">Games overview</router-link></li>
    <li><router-link class="btn" :to="{name: 'new-game'}">New game</router-link></li>
    <li><a href="https://stand-with-ukraine.pp.ua/" class="btn btn-ukraine" target="_blank">
      <icon icon="ukraine-heart" /> Stand with Ukraine <icon icon="ukraine-heart" /></a></li>

    <li style="float:right" v-if="loggedIn">
      <span class="btn" @click="doLogout">Logout</span>
    </li>
    <li style="float:right" v-if="loggedIn">
      <router-link class="btn" :to="{name: 'admin'}">Admin</router-link>
    </li>
  </ul>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router';
import user from '../user'

const route = useRoute();
const showNav = computed(() => {
  // TODO: add info wether to show nav to route props
  return !['game', 'replay'].includes(String(route.name))
})

const loggedIn = ref<boolean>(false);
async function doLogout() {
  await user.logout()
}
onMounted(async () => {
  loggedIn.value = !! user.getMe()
  user.eventBus.on('login', () => {
    console.log('login')
    loggedIn.value = true
  })
  user.eventBus.on('logout', () => {
    console.log('logout')
    loggedIn.value = false
  })
})
</script>
