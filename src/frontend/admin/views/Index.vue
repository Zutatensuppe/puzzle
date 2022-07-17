<template>
  <div>
    <Nav v-if="loggedIn" />
    <LoginForm v-if="!loggedIn" />
  </div>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue';
import user from '../../user';
import Nav from '../components/Nav.vue'
import LoginForm from '../../components/LoginForm.vue';

const loggedIn = ref<boolean>(false);
onMounted(async () => {
  loggedIn.value = user.getMe()?.loggedIn
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
