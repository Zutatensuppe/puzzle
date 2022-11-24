<template>
  <overlay class="login-dialog" @close="emit('close')">
    <template v-slot:default>
      <LoginForm />
    </template>
  </overlay>
</template>
<script setup lang="ts">
import LoginForm from './LoginForm.vue';

const emit = defineEmits<{
  (e: 'close'): void
}>()
</script>
