<template>
  <v-form
    class="password-reset-request-form"
    v-model="valid"
  >
    <v-text-field
      density="compact"
      label="E-Mail"
      v-model="email"
      :rules="emailRules"
    ></v-text-field>

    <v-btn color="success" block :disabled="!valid" @click="doSendPasswordResetEmail">Reset Password</v-btn>
    <v-btn @click="emit('login')" block class="mt-1">Back to login</v-btn>

    <div v-if="res">
      <div v-if="res.error === false">
        Thank you, please check your emails for the password reset email.
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

const email = ref<string>('')

const valid = ref<boolean>(false)

const res = ref<{error: string | false} | null>(null)

const emailRules = [
  v => !!v && /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v) || 'E-mail must be valid'
]

async function doSendPasswordResetEmail() {
  res.value = await user.sendPasswordResetEmail(email.value)
}

</script>
