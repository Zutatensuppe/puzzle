<template>
  <div>
    <h2>Login</h2>
    <table>
      <tr>
        <td>Name:</td>
        <td><input type="text" v-model="login" /></td>
      </tr>
      <tr>
        <td>Pass:</td>
        <td><input type="password" v-model="pass" @keydown.enter.prevent="doLogin" /></td>
      </tr>
      <tr>
        <td colspan="2"><span class="btn" @click="doLogin">Login</span></td>
      </tr>
    </table>
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import user from '../user';

const login = ref<string>('')
const pass = ref<string>('')

async function doLogin() {
  await user.login(login.value, pass.value)
}
</script>
