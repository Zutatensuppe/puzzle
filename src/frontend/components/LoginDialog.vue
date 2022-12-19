<template>
  <Overlay class="login-dialog" @close="emit('close')">
    <template v-slot:default>
      <LoginForm />
    </template>
  </Overlay>
</template>
<script setup lang="ts">
import LoginForm from './LoginForm.vue';
import Overlay from './Overlay.vue';

const emit = defineEmits<{
  (e: 'close'): void
}>()
</script>
