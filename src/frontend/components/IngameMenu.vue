<template>
  <div class="menu">
    <router-link class="opener" :to="{name: 'index'}" target="_blank"><icon icon="puzzle-piece" /> Puzzles</router-link>
    <div class="opener" @click="emit('openDialog', 'preview')"><icon icon="preview" /> Preview</div>
    <div class="opener" @click="emit('openDialog', 'settings')"><icon icon="settings" /> Settings</div>
    <div class="opener" @click="emit('openDialog', 'info')"><icon icon="info" /> Info</div>
    <div class="opener" @click="emit('openDialog', 'help')"><icon icon="hotkey" /> Hotkeys</div>
    <a class="opener" href="https://stand-with-ukraine.pp.ua/" target="_blank"><icon icon="ukraine-heart" /> Stand with Ukraine </a>
  </div>
</template>
<script setup lang="ts">
const emit = defineEmits<{
  (e: 'openDialog', val: 'preview' | 'settings' | 'info' | 'help'): void
}>()
</script>
