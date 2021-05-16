<template>
  <div class="overlay connection-lost" v-if="show">
    <div class="overlay-content" v-if="lostConnection">
      <div>⁉️ LOST CONNECTION ⁉️</div>
      <span class="btn" @click="$emit('reconnect')">Reconnect</span>
    </div>
    <div class="overlay-content" v-if="connecting">
      <div>Connecting...</div>
    </div>
  </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'

import Communication from './../Communication'

export default defineComponent({
  name: 'connection-overlay',
  emits: {
    reconnect: null,
  },
  props: {
    connectionState: Number,
  },
  computed: {
    lostConnection (): boolean {
      return this.connectionState === Communication.CONN_STATE_DISCONNECTED
    },
    connecting (): boolean {
      return this.connectionState === Communication.CONN_STATE_CONNECTING
    },
    show (): boolean {
      return !!(this.lostConnection || this.connecting)
    },
  }
})
</script>
