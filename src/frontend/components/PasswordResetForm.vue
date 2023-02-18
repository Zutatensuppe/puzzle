<template>
  <v-form
    class="registration-form"
    v-model="valid"
    :disabled="busy"
  >
    <v-text-field
      density="compact"
      label="Password"
      v-model="password"
      :append-inner-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
      :type="showPassword ? 'text' : 'password'"
      @click:append-inner="showPassword = !showPassword"
      @keydown.enter.prevent="doChangePassword"
      :rules="passwordRules"
    ></v-text-field>

    <v-btn color="success" block :disabled="!valid || busy" @click="doChangePassword">Reset Password</v-btn>
  </v-form>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { toast } from '../toast';
import user from '../user';

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
  v => !!v || 'Password is required'
]

const doChangePassword = async () => {
  if (!valid.value) {
    return
  }

  busy.value = true
  const res = await user.changePassword(password.value, props.token)
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
