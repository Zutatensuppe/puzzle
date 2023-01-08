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
    <v-btn color="success" @click="doLogin" block :disabled="!valid">Login</v-btn>
  </v-form>
</template>
<script setup lang="ts">
import { ref, Ref } from 'vue';
import user from '../user';

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
  await user.login(email.value, password.value)
}
</script>
