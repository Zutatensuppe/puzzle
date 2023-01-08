<template>
  <div class="registration-form">
    <v-text-field density="compact" label="Username" v-model="username"></v-text-field>
    <v-text-field density="compact" label="E-Mail" v-model="email"></v-text-field>
    <v-text-field density="compact" label="Password" type="password" v-model="password" @keydown.enter.prevent="doRegister"></v-text-field>
    <v-btn color="success" @click="doRegister">Register</v-btn>

    <div v-if="res">
      <div v-if="res.error === false">
        Thank you for registering. Please check your email and click the verify link to complete the registration.
      </div>
      <div v-else>
        {{ res.error }}
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import user from '../user';

const username = ref<string>('')
const email = ref<string>('')
const password = ref<string>('')

const res = ref<{error: string | false} | null>(null)

async function doRegister() {
  res.value = await user.register(username.value, email.value, password.value)
}
</script>
