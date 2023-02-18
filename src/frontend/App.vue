<template>
  <v-app id="app" :theme="'dark'">
    <v-layout>
      <v-main>
        <Nav @show-login="onTriggerLoginOverlay" v-if="!route.meta.ingame" />
        <LoginDialog
          v-if="!route.meta.ingame && showLogin"
          v-model="showLogin"
          @close="showLogin=false"
          :tab="loginDialogTab"
          :token="passwordResetToken"
        />
        <router-view />
      </v-main>
    </v-layout>
  </v-app>
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import LoginDialog from './components/LoginDialog.vue';
import Nav from './components/Nav.vue';
import user from './user';

const route = useRoute()

const showLogin = ref<boolean>(false);
const loginDialogTab = ref<'login' | 'register' | 'forgot-password' | 'reset-password' | undefined>(undefined)
const passwordResetToken = ref<string>('')

const onInit = () => {
  showLogin.value = false
}

const onTriggerLoginOverlay = () => {
  loginDialogTab.value = 'login'
  showLogin.value = true
}

onMounted(async () => {
  user.eventBus.on('login', onInit)
  user.eventBus.on('triggerLoginOverlay', onTriggerLoginOverlay)

  if (window.location.hash) {
    const urlParams = new URLSearchParams(window.location.hash.replace("#","?"));
    const t = urlParams.get('password-reset');
    if (t) {
      loginDialogTab.value = 'reset-password'
      showLogin.value = true
      passwordResetToken.value= t
    }
  }
})
</script>
