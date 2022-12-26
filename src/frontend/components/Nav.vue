<template>
  <v-app-bar v-if="showNav">
    <v-btn size="small" class="mr-1" :to="{name: 'index'}">Games overview</v-btn>
    <v-btn size="small" class="mr-1" :to="{name: 'new-game'}">New game</v-btn>
    <v-btn size="small" class="mr-1" href="https://stand-with-ukraine.pp.ua/" target="_blank">
      <icon icon="ukraine-heart" /> Stand with Ukraine <icon icon="ukraine-heart" />
    </v-btn>
    <v-spacer />
    <v-btn size="small" class="ml-1" v-if="loggedIn" @click="doLogout">Logout</v-btn>
    <v-btn size="small" class="ml-1" v-if="loggedIn" :to="{name: 'admin'}">Admin</v-btn>
  </v-app-bar>
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
