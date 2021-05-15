"use strict"

import Communication from './../Communication.js'

export default {
  name: 'connection-overlay',
  template: `
  <div class="overlay connection-lost" v-if="show">
    <div class="overlay-content" v-if="lostConnection">
      <div>⁉️ LOST CONNECTION ⁉️</div>
      <span class="btn" @click="$emit('reconnect')">Reconnect</span>
    </div>
    <div class="overlay-content" v-if="connectionState === 3">
      <div>Connecting...</div>
    </div>
  </div>`,
  emits: {
    reconnect: null,
  },
  props: {
    connectionState: Number,
  },
  computed: {
    lostConnection () {
      return this.connectionState === Communication.CONN_STATE_DISCONNECTED
    },
    connecting () {
      return this.connectionState === Communication.CONN_STATE_CONNECTING
    },
    show () {
      return this.lostConnection || this.connecting
    },
  }
}
