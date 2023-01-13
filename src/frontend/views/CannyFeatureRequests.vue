<template>
  <Nav @show-login="showLogin = true;" />
  <v-container :fluid="true" class="canny-feature-request-view p-0">
    <CannyWidget
      board="feature-requests"
      board-token="2a23cf97-9976-cfb8-88a7-c7ca0de89aba"
      base-path="/feedback/feature-requests"
    />
  </v-container>
  <LoginDialog v-if="showLogin" v-model="showLogin" @close="showLogin=false" />
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import CannyWidget from '../components/CannyWidget.vue';
import LoginDialog from '../components/LoginDialog.vue';
import Nav from '../components/Nav.vue';
import user from '../user'

const showLogin = ref<boolean>(false);

const onLogin = () => {
  showLogin.value = false
}

onMounted(() => {
  user.eventBus.on('login', onLogin)
})

onBeforeUnmount(() => {
  user.eventBus.off('login', onLogin)
})
</script>
