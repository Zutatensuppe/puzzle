"use strict"

import Time from './../../common/Time.js'

// ingame component
// shows timer, tiles left, etc..
// maybe split it up later

export default {
  name: 'puzzle-status',
  template: `
    <div class="timer">
      <div>
        🧩 {{piecesDone}}/{{piecesTotal}}
      </div>
      <div>
        {{icon}} {{durationStr}}
      </div>
      <slot />
    </div>
  `,
  props: {
    finished: Boolean,
    duration: Number,
    piecesDone: Number,
    piecesTotal: Number,
  },
  computed: {
    icon () {
      return this.finished ? '🏁' : '⏳'
    },
    durationStr () {
      return Time.durationStr(this.duration)
    },
  }
}
