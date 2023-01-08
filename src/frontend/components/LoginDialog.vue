<template>
  <v-dialog width="auto">
    <v-card>
      <v-card-title>Login</v-card-title>

      <v-container :fluid="true">
        <LoginForm />
      </v-container>

      <v-container :fluid="true">
        <v-btn color="#6441a5" prepend-icon="mdi-twitch" @click="openTwitchLogin" target="_blank">Login via Twitch</v-btn>
      </v-container>
    </v-card>
  </v-dialog>
</template>
<script setup lang="ts">
import Util from '../../common/Util';
import LoginForm from './LoginForm.vue';

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
