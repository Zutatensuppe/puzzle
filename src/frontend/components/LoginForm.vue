<template>
  <div class="login-form">
    <v-text-field density="compact" label="E-Mail" v-model="email"></v-text-field>
    <v-text-field density="compact" label="Password" type="password" v-model="password" @keydown.enter.prevent="doLogin"></v-text-field>
    <v-btn color="success" @click="doLogin">Login</v-btn>
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import user from '../user';

const email = ref<string>('')
const password = ref<string>('')

async function doLogin() {
  await user.login(email.value, password.value)
}
</script>
