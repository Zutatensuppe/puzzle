<template>
  <div class="timer">
    <div>
      🧩 {{piecesDone}}/{{piecesTotal}}
    </div>
    <div>
      {{icon}} {{durationStr}}
    </div>
    <slot />
  </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue'
import Time from './../../common/Time'

export default defineComponent({
  props: {
    finished: {
      type: Boolean,
      required: true,
    },
    duration: {
      type: Number,
      required: true,
    },
    piecesDone: {
      type: Number,
      required: true,
    },
    piecesTotal: {
      type: Number,
      required: true,
    },
  },
  computed: {
    icon (): string {
      return this.finished ? '🏁' : '⏳'
    },
    durationStr (): string {
      return Time.durationStr(this.duration)
    },
  }
})
</script>
