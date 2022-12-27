<template>
  <v-app-bar v-if="showNav">
    <div class="header-bar-container d-flex">
      <div class="justify-start">
        <v-btn size="small" class="mr-1" :to="{name: 'index'}" icon="mdi-home" variant="text"></v-btn>
      </div>
      <div class="justify-center">
        <h4 :class="{ index: route.name === 'index' }">{{ route.meta.title }}</h4>
      </div>
      <div class="justify-end">
        <v-btn size="small" class="mr-1" href="https://stand-with-ukraine.pp.ua/" target="_blank">
          <icon icon="ukraine-heart" /> <span class="ml-2 mr-2">Stand with Ukraine</span> <icon icon="ukraine-heart" />
        </v-btn>
        <v-btn size="small" class="ml-1" v-if="loggedIn" @click="doLogout">Logout</v-btn>
        <v-btn size="small" class="ml-1" v-if="loggedIn" :to="{name: 'admin'}">Admin</v-btn>
      </div>
    </div>
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
