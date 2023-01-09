<template>
  <v-dialog width="auto" min-width="450">
    <v-card class="pt-2 pb-6">
      <v-card-title class="pl-6 pr-6">
        <div class="d-flex">
          <img src="./../assets/gfx/icon.png" width="32" height="32" class="mr-1" />
          <div class="flex-grow-1" v-if="tab === 'login'">Login</div>
          <div class="flex-grow-1" v-if="tab === 'register'">Register a free account</div>
          <div class="flex-grow-1" v-if="tab === 'forgot-password'">Forgot password</div>
          <div class="flex-grow-1" v-if="tab === 'reset-password'">Reset password</div>
          <v-btn icon="mdi-close" variant="text" size="x-small" @click="emit('close')"></v-btn>
        </div>
      </v-card-title>

      <v-card-text>
        <v-window v-model="tab">
          <v-window-item value="login">
            <LoginForm @forgot-password="tab='forgot-password'" @register="tab='register'" />
            <v-divider class="mt-6 mb-6" />
            <v-btn color="#6441a5" prepend-icon="mdi-twitch" @click="openTwitchLogin" block>Login via Twitch</v-btn>
          </v-window-item>

          <v-window-item value="register">
            <RegistrationForm @login="tab='login'" />
          </v-window-item>

          <v-window-item value="forgot-password">
            <PasswordResetRequestForm @login="tab='login'" />
          </v-window-item>

          <v-window-item value="reset-password">
            <PasswordResetForm @password-changed="tab='login'" :token="token || ''" />
          </v-window-item>
        </v-window>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import Util from '../../common/Util';
import LoginForm from './LoginForm.vue';
import PasswordResetForm from './PasswordResetForm.vue';
import PasswordResetRequestForm from './PasswordResetRequestForm.vue';
import RegistrationForm from './RegistrationForm.vue';

const tab = ref<'login' | 'register' | 'forgot-password' | 'reset-password'>('login')

const props = defineProps<{
  tab?: 'login' | 'register' | 'forgot-password' | 'reset-password',
  token?: string,
}>()

if (props.tab) {
  tab.value = props.tab
}

const emit = defineEmits<{
  (e: 'close'): void,
}>()

const args = {
  client_id: 'ud669t6lfspxucc6hvn5e5kto8rllb',
  redirect_uri: `${window.location.protocol}//${window.location.host}/api/auth/twitch/redirect_uri`,
  response_type: 'code',
  scope: 'openid',
}

const openTwitchLogin = () => {
  window.open(`https://id.twitch.tv/oauth2/authorize${Util.asQueryArgs(args)}`)
}
</script>
