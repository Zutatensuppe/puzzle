<template>
  <i
    class="icon"
    :class="`icon-${icon}`"
  />
</template>
<script setup lang="ts">
defineProps<{
  icon: string,
}>()
</script>
