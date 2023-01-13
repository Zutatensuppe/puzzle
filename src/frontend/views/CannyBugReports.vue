<template>
  <Nav @show-login="showLogin = true;" />
  <CannyWidget
    board="bug-reports"
    board-token="c696a91d-e81a-7036-13b4-4971012a6d48"
    base-path="/feedback/bug-reports"
  />
  <LoginDialog v-if="showLogin" v-model="showLogin" @close="showLogin=false" />
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import CannyWidget from '../components/CannyWidget.vue';
import LoginDialog from '../components/LoginDialog.vue';
import Nav from '../components/Nav.vue';
import user from '../user'

const showLogin = ref<boolean>(false);

const onInit = () => {
  showLogin.value = false
}

onMounted(() => {
  user.eventBus.on('login', onInit)
})

onBeforeUnmount(() => {
  user.eventBus.off('login', onInit)
})
</script>
