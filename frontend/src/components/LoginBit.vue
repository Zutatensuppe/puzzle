<template>
  <div class="justify-end">
    <div
      v-if="me && loggedIn"
      class="user-welcome-message"
    >
      Hello, {{ me.name }}
      <v-btn @click="logout">
        Logout
      </v-btn>
    </div>
    <v-btn
      v-else
      size="small"
      class="ml-1"
      @click="openLoginDialog"
    >
      Login
    </v-btn>
  </div>
</template>
<script setup lang="ts">
import { useDialog } from '../useDialog'
import { me, loggedIn, logout } from '../user'

const { openLoginDialog } = useDialog()
</script>
