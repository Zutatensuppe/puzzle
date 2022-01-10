<template>
  <overlay class="transparent">
    <template v-slot:default>
      <table class="help">
        <tr><td>⬆️ Move up:</td><td><div><kbd>W</kbd>/<kbd>↑</kbd>/🖱️</div></td></tr>
        <tr><td>⬇️ Move down:</td><td><div><kbd>S</kbd>/<kbd>↓</kbd>/🖱️</div></td></tr>
        <tr><td>⬅️ Move left:</td><td><div><kbd>A</kbd>/<kbd>←</kbd>/🖱️</div></td></tr>
        <tr><td>➡️ Move right:</td><td><div><kbd>D</kbd>/<kbd>→</kbd>/🖱️</div></td></tr>
        <tr><td></td><td><div>Move faster by holding <kbd>Shift</kbd></div></td></tr>

        <tr><td>🔍+ Zoom in:</td><td><div><kbd>E</kbd>/🖱️-Wheel</div></td></tr>
        <tr><td>🔍- Zoom out:</td><td><div><kbd>Q</kbd>/🖱️-Wheel</div></td></tr>
        <tr><td>🖼️ Toggle preview:</td><td><div><kbd>Space</kbd></div></td></tr>
        <tr><td>🎯 Center puzzle in screen:</td><td><div><kbd>C</kbd></div></td></tr>

        <tr><td>🧩✔️ Toggle fixed pieces:</td><td><div><kbd>F</kbd></div></td></tr>
        <tr><td>🧩❓ Toggle loose pieces:</td><td><div><kbd>G</kbd></div></td></tr>

        <tr><td>👤 Toggle player names:</td><td><div><kbd>N</kbd></div></td></tr>
        <tr><td>🔉 Toggle sounds:</td><td><div><kbd>M</kbd></div></td></tr>

        <tr><td>🎯 Store position [0-9]:</td><td><div><kbd>Shift</kbd> + <kbd>0</kbd>-<kbd>9</kbd></div></td></tr>
        <tr><td>🎯 Restore position [0-9]:</td><td><div><kbd>0</kbd>-<kbd>9</kbd></div></td></tr>

        <tr><td>⏫ Speed up (replay):</td><td><div><kbd>I</kbd></div></td></tr>
        <tr><td>⏬ Speed down (replay):</td><td><div><kbd>O</kbd></div></td></tr>
        <tr><td>⏸️ Pause (replay):</td><td><div><kbd>P</kbd></div></td></tr>
      </table>
    </template>
  </overlay>
</template>
<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
})
</script>
