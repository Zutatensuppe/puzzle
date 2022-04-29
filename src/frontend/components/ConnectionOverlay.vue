<template>
  <overlay class="connection-lost" v-show="show">
    <template v-slot:default>
      <div v-if="lostConnection"><icon icon="disconnect" /> LOST CONNECTION <icon icon="disconnect" /></div>
      <span v-if="lostConnection" class="btn" @click="$emit('reconnect')">Reconnect</span>
      <div v-if="connecting">Connecting...</div>
    </template>
  </overlay>
</template>
<script lang="ts">
import { defineComponent } from 'vue'

import Communication from './../Communication'

export default defineComponent({
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
