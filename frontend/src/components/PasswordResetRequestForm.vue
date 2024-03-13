<template>
  <v-form
    v-model="valid"
    class="password-reset-request-form"
    :disabled="busy"
  >
    <v-text-field
      v-model="email"
      density="compact"
      label="E-mail"
      :rules="emailRules"
    />

    <v-btn
      color="success"
      block
      :disabled="!valid || busy"
      @click="doSendPasswordResetEmail"
    >
      Reset Password
    </v-btn>
    <TextDivider text="Or did you remember?" />
    <v-btn
      block
      class="mt-1"
      :disabled="busy"
      prepend-icon="mdi-heart"
      @click="emit('login')"
    >
      Back to login
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
}>()

const email = ref<string>('')

const valid = ref<boolean>(false)
const busy = ref<boolean>(false)

const emailRules = [
  v => !!v && testEmailValid(v) || 'E-mail must be valid',
]

async function doSendPasswordResetEmail() {
  if (!valid.value) {
    return
  }

  busy.value = true
  const res = await user.sendPasswordResetEmail(email.value)
  if (res.error) {
    toast(res.error, 'error')
  } else {
    toast('Thank you, please check your emails for the password reset email.', 'success', 10000)
    user.eventBus.emit('closeLoginDialog')
  }
  busy.value = false
}

</script>
