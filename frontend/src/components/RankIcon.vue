<template>
  <span
    v-if="rank"
    :title="`${rank}. place`"
  >
    <v-icon
      v-if="rank === 1"
      icon="mdi-podium-gold"
      class="text-amber"
    />
    <v-icon
      v-else-if="rank === 2"
      icon="mdi-podium-silver"
      class="text-blue-grey"
    />
    <v-icon
      v-else-if="rank === 3"
      icon="mdi-podium-bronze"
      class="text-brown"
    />
    <span v-else>{{ rank }}</span>
  </span>
  <span v-else>
    {{ unrankedFallback }}
  </span>
</template>
<script setup lang="ts">

defineProps<{
  rank: number | null
  unrankedFallback: string
}>()
</script>
