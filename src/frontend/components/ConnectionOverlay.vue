<template>
  <v-dialog
    v-model="show"
    class="overlay-connection"
  >
    <v-card>
      <v-container :fluid="true">
        <div
          v-if="lostConnection"
          class="d-flex justify-center mb-2"
        >
          <h4>CONNECTION LOST</h4>
        </div>
        <div
          v-if="lostConnection"
          class="d-flex justify-center"
        >
          <v-btn
            color="info"
            prepend-icon="mdi-wifi"
            @click="emit('reconnect')"
          >
            Reconnect
          </v-btn>
        </div>
        <div
          v-if="connecting"
          class="d-flex justify-center"
        >
          Connecting...
        </div>
      </v-container>
    </v-card>
  </v-dialog>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import Communication from '../Communication'

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
