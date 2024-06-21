<template>
  <v-container>
    <Nav v-if="loggedIn" />
    <LoginForm v-if="!loggedIn" />
  </v-container>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import user from '../../user'
import Nav from '../components/Nav.vue'
import LoginForm from '../../components/LoginForm.vue'

const loggedIn = ref<boolean>(false)
onMounted(async () => {
  const me = user.getMe()
  loggedIn.value = !!(me && me.type === 'user')
  user.eventBus.on('login', async () => {
    console.log('login')
    loggedIn.value = true
  })
  user.eventBus.on('logout', () => {
    console.log('logout')
    loggedIn.value = false
  })
})
</script>
