<template>
  <v-dialog
    width="auto"
    min-width="450"
  >
    <v-card class="pt-2 pb-6">
      <v-card-title class="pl-6 pr-6">
        <div class="d-flex">
          <img
            src="./../assets/gfx/icon.png"
            width="32"
            height="32"
            class="mr-1"
          >
          <div
            v-if="tab === 'login'"
            class="flex-grow-1"
          >
            Login
          </div>
          <div
            v-if="tab === 'register'"
            class="flex-grow-1"
          >
            Register a free account
          </div>
          <div
            v-if="tab === 'forgot-password'"
            class="flex-grow-1"
          >
            Forgot password
          </div>
          <div
            v-if="tab === 'reset-password'"
            class="flex-grow-1"
          >
            Reset password
          </div>
          <v-btn
            icon="mdi-close"
            variant="text"
            size="x-small"
            @click="emit('close')"
          />
        </div>
      </v-card-title>

      <v-card-text>
        <v-window v-model="tab">
          <v-window-item value="login">
            <LoginForm
              @forgot-password="tab='forgot-password'"
              @register="tab='register'"
            />
          </v-window-item>

          <v-window-item value="register">
            <RegistrationForm @login="tab='login'" />
          </v-window-item>

          <v-window-item value="forgot-password">
            <PasswordResetRequestForm @login="tab='login'" />
          </v-window-item>

          <v-window-item value="reset-password">
            <PasswordResetForm
              :token="token || ''"
              @password-changed="tab='login'"
            />
          </v-window-item>
        </v-window>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import LoginForm from './LoginForm.vue'
import PasswordResetForm from './PasswordResetForm.vue'
import PasswordResetRequestForm from './PasswordResetRequestForm.vue'
import RegistrationForm from './RegistrationForm.vue'

const props = defineProps<{
  tab?: 'login' | 'register' | 'forgot-password' | 'reset-password',
  token?: string,
}>()

const tab = ref<'login' | 'register' | 'forgot-password' | 'reset-password'>(props.tab || 'login')

const emit = defineEmits<{
  (e: 'close'): void,
}>()
</script>
