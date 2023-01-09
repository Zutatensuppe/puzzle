<template>
  <v-form
    class="registration-form"
    v-model="valid"
  >
    <v-text-field
      density="compact"
      label="Username"
      v-model="username"
      :rules="usernameRules"
    ></v-text-field>
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
      @keydown.enter.prevent="doRegister"
      :rules="passwordRules"
    ></v-text-field>
    <v-btn color="success" @click="doRegister" block :disabled="!valid">Create account</v-btn>
    <v-btn @click="emit('login')" block class="mt-1">Already have an account?</v-btn>

    <div v-if="res">
      <div v-if="res.error === false">
        Thank you for registering. Please check your email and click the verify link to complete the registration.
      </div>
      <div v-else>
        {{ res.error }}
      </div>
    </div>
  </v-form>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import user from '../user';

const emit = defineEmits<{
  (e: 'login'): void
}>()

const username = ref<string>('')
const email = ref<string>('')
const password = ref<string>('')

const showPassword = ref<boolean>(false)

const res = ref<{error: string | false} | null>(null)

const valid = ref<boolean>(false)

const usernameRules = [
  v => !!v || 'Username is required'
]

const passwordRules = [
  v => !!v || 'Password is required'
]

const emailRules = [
  v => !!v && /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v) || 'E-mail must be valid'
]

async function doRegister() {
  if (!valid.value) {
    return
  }
  res.value = await user.register(username.value, email.value, password.value)
}
</script>
