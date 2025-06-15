<template>
  <v-form
    v-model="valid"
    class="registration-form"
    :disabled="busy"
  >
    <v-text-field
      v-model="username"
      density="compact"
      label="Username"
      autocomplete="new-username"
      :rules="usernameRules"
    />
    <v-text-field
      v-model="email"
      density="compact"
      label="E-mail"
      autocomplete="new-email"
      :rules="emailRules"
    />
    <v-text-field
      v-model="password"
      density="compact"
      label="Password"
      :append-inner-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
      :type="showPassword ? 'text' : 'password'"
      :rules="passwordRules"
      autocomplete="new-password"
      @click:append-inner="showPassword = !showPassword"
      @keydown.enter.prevent="doRegister"
    />
    <v-btn
      color="success"
      block
      :disabled="!valid || busy"
      @click="doRegister"
    >
      Create account
    </v-btn>
    <TextDivider text="Already have an account?" />
    <v-btn
      block
      class="mt-1"
      :disabled="busy"
      prepend-icon="mdi-heart"
      @click="emit('login')"
    >
      Login now
    </v-btn>
  </v-form>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import { toast } from '../toast'
import user from '../user'
import { testEmailValid } from '../util'
import TextDivider from './TextDivider.vue'

const emit = defineEmits<{
  (e: 'login'): void
  (e: 'register-success'): void
}>()

const username = ref<string>('')
const email = ref<string>('')
const password = ref<string>('')

const showPassword = ref<boolean>(false)

const valid = ref<boolean>(false)
const busy = ref<boolean>(false)

const usernameRules = [
  (v: string) => !!v || 'Username is required',
]

const passwordRules = [
  (v: string) => !!v || 'Password is required',
]

const emailRules = [
  (v: string) => !!v && testEmailValid(v) || 'E-mail must be valid',
]

async function doRegister() {
  if (!valid.value) {
    return
  }

  busy.value = true
  const res = await user.register(username.value, email.value, password.value)
  if (res.error) {
    toast(res.error, 'error')
  } else {
    toast('Thank you for registering. Please check your email and click the verify link to complete the registration.', 'success', 10000)
    emit('register-success')
  }
  busy.value = false
}
</script>
