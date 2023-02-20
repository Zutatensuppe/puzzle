<template>
  <img v-if="game" :src="game.getPreviewImageUrl()" style="width: 1px; height: 1px; position: absolute; left: -10px;"/>
</template>
<script setup lang="ts">
import { Game } from '../Game';

// this displays the current puzzle image, it is kind of a hack
// to always keep an image element with the preview url, so that
// opening the preview goes very quickly. even with server side
// caching the browser will re- create the image and this will
// take a second for large images for some reason!

defineProps<{
  game: Game<any> | null,
}>()
</script>
