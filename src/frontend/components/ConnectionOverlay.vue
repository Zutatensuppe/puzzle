<template>
  <v-dialog class="connection-lost" v-model="show">
    <div v-if="lostConnection"><icon icon="disconnect" /> LOST CONNECTION <icon icon="disconnect" /></div>
    <span v-if="lostConnection" class="btn" @click="emit('reconnect')">Reconnect</span>
    <div v-if="connecting">Connecting...</div>
  </v-dialog>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import Communication from '../Communication';

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
