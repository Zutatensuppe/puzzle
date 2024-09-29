<template>
  <v-app
    id="app"
    :theme="'dark'"
  >
    <v-layout>
      <v-main>
        <Nav v-if="!route.meta.ingame" />
        <LoginDialog
          v-if="showLogin"
          v-model="showLogin"
          :tab="loginDialogTab"
          :token="passwordResetToken"
          @close="showLogin=false"
        />
        <router-view />
      </v-main>
    </v-layout>
  </v-app>
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import LoginDialog from './components/LoginDialog.vue'
import Nav from './components/Nav.vue'
import user from './user'
import { toast } from './toast'

const route = useRoute()

const showLogin = ref<boolean>(false)
const loginDialogTab = ref<'login' | 'register' | 'forgot-password' | 'reset-password' | undefined>(undefined)
const passwordResetToken = ref<string>('')

const onInit = () => {
  showLogin.value = false
}

const onTriggerLoginDialog = () => {
  loginDialogTab.value = 'login'
  showLogin.value = true
}

const onCloseLoginDialog = () => {
  showLogin.value = false
}

onMounted(() => {
  user.eventBus.on('login', onInit)
  user.eventBus.on('triggerLoginDialog', onTriggerLoginDialog)
  user.eventBus.on('closeLoginDialog', onCloseLoginDialog)

  if (window.location.hash) {
    const urlParams = new URLSearchParams(window.location.hash.replace('#','?'))
    const passwordResetTokenValue = urlParams.get('password-reset')
    if (passwordResetTokenValue) {
      loginDialogTab.value = 'reset-password'
      showLogin.value = true
      passwordResetToken.value = passwordResetTokenValue
    }
    const emailVerified = urlParams.get('email-verified')
    if (emailVerified) {
      toast('Thank you for verifying your e-mail address! You should already be logged in.', 'success', 7000)
    }
  }
})
</script>
