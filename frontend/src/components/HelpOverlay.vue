<template>
  <v-card>
    <v-container :fluid="true">
      <h4>Hotkeys</h4>
      <v-table density="compact">
        <tbody>
          <tr><td><icon icon="arrow-up" /> Move up:</td><td><div><kbd>W</kbd>/<kbd>↑</kbd>/<icon icon="mouse-left" /></div></td></tr>
          <tr><td><icon icon="arrow-down" /> Move down:</td><td><div><kbd>S</kbd>/<kbd>↓</kbd>/<icon icon="mouse-left" /></div></td></tr>
          <tr><td><icon icon="arrow-left" /> Move left:</td><td><div><kbd>A</kbd>/<kbd>←</kbd>/<icon icon="mouse-left" /></div></td></tr>
          <tr><td><icon icon="arrow-right" /> Move right:</td><td><div><kbd>D</kbd>/<kbd>→</kbd>/<icon icon="mouse-left" /></div></td></tr>
          <tr><td /><td><div>Move faster by holding <kbd>Shift</kbd></div></td></tr>

          <tr><td><icon icon="puzzle-piece-rotate-left" /> Rotate piece left: </td><td><div><kbd>Z</kbd>/<icon icon="mouse-left" /> + <icon icon="mouse-wheel" /> up</div></td></tr>
          <tr><td><icon icon="puzzle-piece-rotate-right" /> Rotate piece right: </td><td><div><kbd>X</kbd>/<icon icon="mouse-left" /> + <icon icon="mouse-wheel" /> down</div></td></tr>

          <tr><td><icon icon="zoom-in" /> Zoom in:</td><td><div><kbd>E</kbd>/<icon icon="mouse-wheel" /></div></td></tr>
          <tr><td><icon icon="zoom-out" /> Zoom out:</td><td><div><kbd>Q</kbd>/<icon icon="mouse-wheel" /></div></td></tr>
          <tr><td><icon icon="preview" /> Toggle preview:</td><td><div><kbd>Space</kbd></div></td></tr>
          <tr><td><icon icon="center" /> Center puzzle in screen:</td><td><div><kbd>C</kbd></div></td></tr>

          <tr><td><icon icon="puzzle-piece-locked" /> Toggle fixed pieces:</td><td><div><kbd>F</kbd></div></td></tr>
          <tr><td><icon icon="puzzle-piece-free" /> Toggle loose pieces:</td><td><div><kbd>G</kbd></div></td></tr>
          <tr><td><icon icon="table" /> Toggle table:</td><td><div><kbd>T</kbd></div></td></tr>
          <tr><td><icon icon="puzzle-background" /> Toggle puzzle background:</td><td><div><kbd>B</kbd></div></td></tr>
          <tr><td><icon icon="eye" /> Toggle interface:</td><td><div><kbd>H</kbd></div></td></tr>

          <tr><td><icon icon="player-name" /> Toggle player names:</td><td><div><kbd>N</kbd></div></td></tr>
          <tr><td><icon icon="volume-up" /> Toggle sounds:</td><td><div><kbd>M</kbd></div></td></tr>

          <tr><td><icon icon="save-pos" /> Store position [0-9]:</td><td><div><kbd>Shift</kbd> + <kbd>0</kbd>-<kbd>9</kbd></div></td></tr>
          <tr><td><icon icon="load-pos" /> Restore position [0-9]:</td><td><div><kbd>0</kbd>-<kbd>9</kbd></div></td></tr>

          <tr><td><icon icon="speed-up" /> Speed up (replay):</td><td><div><kbd>I</kbd></div></td></tr>
          <tr><td><icon icon="speed-down" /> Speed down (replay):</td><td><div><kbd>O</kbd></div></td></tr>
          <tr><td><icon icon="pause" /> Pause (replay):</td><td><div><kbd>P</kbd></div></td></tr>
        </tbody>
      </v-table>
    </v-container>
  </v-card>
</template>
<style scoped>
.v-table { background: transparent; }
</style>
