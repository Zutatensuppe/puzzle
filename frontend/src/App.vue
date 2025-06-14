<template>
  <v-app
    id="app"
    :theme="'dark'"
  >
    <v-layout>
      <v-main>
        <Nav v-if="!route.meta.ingame" />
        <Dialog />
        <router-view />
      </v-main>
    </v-layout>
  </v-app>
</template>
<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'
import Dialog from './components/Dialog.vue'
import Nav from './components/Nav.vue'
import { useDialog } from './useDialog'
import { toast } from './toast'

const route = useRoute()
const { openLoginDialog } = useDialog()

onMounted(() => {
  if (window.location.hash) {
    const urlParams = new URLSearchParams(window.location.hash.replace('#', '?'))
    const passwordResetToken = urlParams.get('password-reset')
    if (passwordResetToken) {
      openLoginDialog('reset-password', { passwordResetToken })
    }
    const emailVerified = urlParams.get('email-verified')
    if (emailVerified) {
      toast('Thank you for verifying your e-mail address! You should already be logged in.', 'success', 7000)
    }
  }
})
</script>
