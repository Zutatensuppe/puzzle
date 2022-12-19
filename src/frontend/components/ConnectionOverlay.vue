<template>
  <Overlay class="connection-lost" v-show="show" @close="emit('close')">
    <template v-slot:default>
      <div v-if="lostConnection"><icon icon="disconnect" /> LOST CONNECTION <icon icon="disconnect" /></div>
      <span v-if="lostConnection" class="btn" @click="emit('reconnect')">Reconnect</span>
      <div v-if="connecting">Connecting...</div>
    </template>
  </Overlay>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import Communication from '../Communication';
import Overlay from './Overlay.vue';

const emit = defineEmits<{
  (e: 'reconnect'): void
  (e: 'close'): void
}>()

const props = defineProps<{
  connectionState: number
}>()

const lostConnection = computed((): boolean => {
  return props.connectionState === Communication.CONN_STATE_DISCONNECTED
})

const connecting = computed((): boolean => {
  return props.connectionState === Communication.CONN_STATE_CONNECTING
})

const show = computed((): boolean => {
  return !!(lostConnection.value || connecting.value)
})
</script>
