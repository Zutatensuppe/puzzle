<template>
  <v-form
    class="login-form"
    v-model="valid"
  >
    <v-text-field
      density="compact"
      label="E-Mail"
      v-model="email"
      :rules="emailRules"
    ></v-text-field>
    <v-text-field
      density="compact"
      label="Password"
      v-model="password"
      :append-inner-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
      :type="showPassword ? 'text' : 'password'"
      @click:append-inner="showPassword = !showPassword"
      @keydown.enter.prevent="doLogin"
      :rules="passwordRules"
    ></v-text-field>
    <div class="d-flex justify-space-between">
      <v-btn @click="emit('forgot-password')">Forgot password?</v-btn>
      <v-btn color="success" @click="doLogin" :disabled="!valid">Login</v-btn>
    </div>
    <div class="d-flex align-center justify-center mt-5">
      No account yet? <v-btn @click="emit('register')" class="ml-5">Create one</v-btn>
    </div>
  </v-form>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import user from '../user';

const emit = defineEmits<{
  (e: 'forgot-password'): void
  (e: 'register'): void
}>()

const email = ref<string>('')
const password = ref<string>('')

const showPassword = ref<boolean>(false)

const valid = ref<boolean>(false)

const passwordRules = [
  v => !!v || 'Password is required'
]

const emailRules = [
  v => !!v && /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v) || 'E-mail must be valid'
]

async function doLogin() {
  if (!valid.value) {
    return
  }
  await user.login(email.value, password.value)
}
</script>
