<template>
  <v-form
    class="registration-form"
    v-model="valid"
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

    <v-btn color="success" block :disabled="!valid" @click="doChangePassword">Reset Password</v-btn>

    <div v-if="res && res.error !== false">
      {{ res.error }}
    </div>
  </v-form>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import user from '../user';

const props = defineProps<{
  token: string,
}>()

const emit = defineEmits<{
  (e: 'password-changed'): void,
}>()

const res = ref<{error: string | false} | null>(null)

const password = ref<string>('')
const valid = ref<boolean>(false)
const showPassword = ref<boolean>(false)
const passwordRules = [
  v => !!v || 'Password is required'
]

const doChangePassword = async () => {
  if (!valid.value) {
    return
  }
  res.value = await user.changePassword(password.value, props.token)
  if (res.value.error === false) {
    window.location.hash = ''
    emit('password-changed')
  }
}

</script>
