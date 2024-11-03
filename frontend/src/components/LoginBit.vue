<template>
  <div class="justify-end">
    <div
      v-if="me && loggedIn"
      class="user-welcome-message"
    >
      Hello, {{ me.name }}
      <v-btn
        @click="logout"
      >
        Logout
      </v-btn>
    </div>
    <v-btn
      v-else
      size="small"
      class="ml-1"
      @click="login"
    >
      Login
    </v-btn>
  </div>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import user, { User } from '../user'

const me = ref<User|null>(null)

const loggedIn = computed(() => {
  return !!(me.value && me.value.type === 'user')
})

async function logout() {
  await user.logout()
}

const onInit = () => {
  me.value = user.getMe()
}

const login = () => {
  user.eventBus.emit('triggerLoginDialog')
}

onMounted(() => {
  onInit()
  user.eventBus.on('login', onInit)
  user.eventBus.on('logout', onInit)
})

onBeforeUnmount(() => {
  user.eventBus.off('login', onInit)
  user.eventBus.off('logout', onInit)
})
</script>
