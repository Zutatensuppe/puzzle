<template>
  <v-card class="pt-2 pb-6">
    <v-card-title class="pl-6 pr-6">
      <div class="d-flex">
        <img
          src="./../../assets/gfx/icon.png"
          width="32"
          height="32"
          class="mr-1"
        >
        <div
          v-if="loginDialogTab === 'login'"
          class="flex-grow-1"
        >
          Login
        </div>
        <div
          v-if="loginDialogTab === 'register'"
          class="flex-grow-1"
        >
          Register a free account
        </div>
        <div
          v-if="loginDialogTab === 'forgot-password'"
          class="flex-grow-1"
        >
          Forgot password
        </div>
        <div
          v-if="loginDialogTab === 'reset-password'"
          class="flex-grow-1"
        >
          Reset password
        </div>
        <v-btn
          icon="mdi-close"
          variant="text"
          size="x-small"
          @click="closeDialog"
        />
      </div>
    </v-card-title>

    <v-card-text>
      <v-window v-model="loginDialogTab">
        <v-window-item value="login">
          <LoginForm
            @forgot-password="loginDialogTab='forgot-password'"
            @register="loginDialogTab='register'"
          />
        </v-window-item>

        <v-window-item value="register">
          <RegistrationForm
            @login="loginDialogTab='login'"
            @register-success="closeDialog"
          />
        </v-window-item>

        <v-window-item value="forgot-password">
          <PasswordResetRequestForm
            @login="loginDialogTab='login'"
            @reset-success="closeDialog"
          />
        </v-window-item>

        <v-window-item value="reset-password">
          <PasswordResetForm
            :token="loginDialogData?.passwordResetToken || ''"
            @password-changed="loginDialogTab='login'"
          />
        </v-window-item>
      </v-window>
    </v-card-text>
  </v-card>
</template>
<script setup lang="ts">
import { useDialog } from '../../useDialog'

import LoginForm from '../LoginForm.vue'
import PasswordResetForm from '../PasswordResetForm.vue'
import PasswordResetRequestForm from '../PasswordResetRequestForm.vue'
import RegistrationForm from '../RegistrationForm.vue'

const { closeDialog, loginDialogData, loginDialogTab } = useDialog()
</script>
