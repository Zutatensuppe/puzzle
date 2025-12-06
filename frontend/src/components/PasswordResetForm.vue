<template>
  <v-form
    v-model="valid"
    class="registration-form"
    :disabled="busy"
  >
    <v-text-field
      v-model="password"
      density="compact"
      label="Password"
      :append-inner-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
      :type="showPassword ? 'text' : 'password'"
      :rules="passwordRules"
      autocomplete="new-password"
      @click:append-inner="showPassword = !showPassword"
      @keydown.enter.prevent="doChangePassword"
    />

    <v-btn
      color="success"
      block
      :disabled="!valid || busy"
      @click="doChangePassword"
    >
      Reset Password
    </v-btn>
  </v-form>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import { toast } from '../toast'
import { api } from '../user'

const props = defineProps<{
  token: string,
}>()

const emit = defineEmits<{
  (e: 'password-changed'): void,
}>()

const password = ref<string>('')
const valid = ref<boolean>(false)
const busy = ref<boolean>(false)
const showPassword = ref<boolean>(false)
const passwordRules = [
  (v: string) => !!v || 'Password is required',
]

const doChangePassword = async () => {
  if (!valid.value) {
    return
  }

  busy.value = true
  const res = await api.changePassword(password.value, props.token)
  if (res.error !== false) {
    toast(res.error, 'error')
  } else {
    window.location.hash = ''
    toast('Password changed successfully', 'success')
    emit('password-changed')
  }
  busy.value = false
}

</script>
