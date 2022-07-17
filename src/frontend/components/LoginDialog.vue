<template>
  <overlay class="login-dialog">
    <template v-slot:default>
      <LoginForm />
    </template>
  </overlay>
</template>
<script setup lang="ts">
import LoginForm from './LoginForm.vue';
</script>
