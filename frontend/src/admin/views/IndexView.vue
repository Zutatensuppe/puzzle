<template>
  <v-container>
    <Nav v-if="loggedIn" />
    <LoginForm v-if="!loggedIn" />
    <div v-else-if="serverInfo">
      Socket count: {{ serverInfo.socketCount }}
    </div>
  </v-container>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import user from '../../user'
import Nav from '../components/Nav.vue'
import LoginForm from '../../components/LoginForm.vue'
import api from '../../_api'

const serverInfo = ref<any>(null)

const loggedIn = ref<boolean>(false)
onMounted(async () => {
  const me = user.getMe()
  loggedIn.value = !!(me && me.type === 'user')
  if (me) {
    serverInfo.value = await api.admin.getServerInfo()
  }
  user.eventBus.on('login', async () => {
    console.log('login')
    loggedIn.value = true
    serverInfo.value = await api.admin.getServerInfo()
  })
  user.eventBus.on('logout', () => {
    console.log('logout')
    loggedIn.value = false
    serverInfo.value = null
  })
})
</script>
