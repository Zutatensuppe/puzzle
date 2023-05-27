<template>
  <v-form
    v-model="valid"
    class="login-form"
    :disabled="busy"
  >
    <v-text-field
      v-model="email"
      density="compact"
      label="E-Mail"
      :rules="emailRules"
    />
    <v-text-field
      v-model="password"
      density="compact"
      label="Password"
      :append-inner-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
      :type="showPassword ? 'text' : 'password'"
      :rules="passwordRules"
      @click:append-inner="showPassword = !showPassword"
      @keydown.enter.prevent="doLogin"
    />
    <div class="d-flex justify-space-between">
      <v-btn
        :disabled="busy"
        @click="emit('forgot-password')"
      >
        Forgot password?
      </v-btn>
      <v-btn
        color="success"
        :disabled="!valid || busy"
        @click="doLogin"
      >
        Login
      </v-btn>
    </div>
    <div class="d-flex align-center justify-center mt-5">
      No account yet? <v-btn
        class="ml-5"
        :disabled="busy"
        @click="emit('register')"
      >
        Create one
      </v-btn>
    </div>
  </v-form>
  <v-divider class="mt-6 mb-6" />
  <v-btn
    color="#6441a5"
    prepend-icon="mdi-twitch"
    block
    :disabled="busy"
    @click="openTwitchLogin"
  >
    Login via Twitch
  </v-btn>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import Util from '../../../common/src/Util'
import { toast } from '../toast'
import user from '../user'

const emit = defineEmits<{
  (e: 'forgot-password'): void
  (e: 'register'): void
}>()

const email = ref<string>('')
const password = ref<string>('')

const showPassword = ref<boolean>(false)

const valid = ref<boolean>(false)
const busy = ref<boolean>(false)

const passwordRules = [
  v => !!v || 'Password is required',
]

const emailRules = [
  v => !!v && /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v) || 'E-mail must be valid',
]

const args = {
  client_id: 'ud669t6lfspxucc6hvn5e5kto8rllb',
  redirect_uri: `${window.location.protocol}//${window.location.host}/api/auth/twitch/redirect_uri`,
  response_type: 'code',
  scope: 'openid user:read:email',
}

const openTwitchLogin = () => {
  window.open(`https://id.twitch.tv/oauth2/authorize${Util.asQueryArgs(args)}`)
}

async function doLogin() {
  if (!valid.value) {
    return
  }

  busy.value = true
  const res = await user.login(email.value, password.value)
  if (res.error) {
    if (res.error === 'bad email' || res.error === 'bad password') {
      toast('Invalid login credentials. Please check your email and password. If you\'ve forgotten your password, click \'Forgot Password?\'.', 'error', 7000)
    } else if (res.error  === 'email not verified') {
      toast('Your account is not verified. Please check your email\'s for the verification email and click the link in it.', 'error', 7000)
    } else {
      toast('An unknown error occured during login. Please try again later.', 'error')
    }
  } else {
    toast('Login successful!', 'success')
  }
  busy.value = false
}
</script>