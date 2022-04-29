<template>
  <i class="icon" :class="`icon-${icon}`"></i>
</template>
<script setup lang="ts">
defineProps<{
  icon: string,
}>()
</script>
