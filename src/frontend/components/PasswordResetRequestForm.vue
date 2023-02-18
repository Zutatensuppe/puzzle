<template>
  <v-form
    class="password-reset-request-form"
    v-model="valid"
    :disabled="busy"
  >
    <v-text-field
      density="compact"
      label="E-Mail"
      v-model="email"
      :rules="emailRules"
    ></v-text-field>

    <v-btn color="success" block :disabled="!valid || busy" @click="doSendPasswordResetEmail">Reset Password</v-btn>
    <v-btn @click="emit('login')" block class="mt-1" :disabled="busy">Back to login</v-btn>
  </v-form>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { toast } from '../toast';
import user from '../user';

const emit = defineEmits<{
  (e: 'login'): void
}>()

const email = ref<string>('')

const valid = ref<boolean>(false)
const busy = ref<boolean>(false)

const emailRules = [
  v => !!v && /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v) || 'E-mail must be valid'
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
