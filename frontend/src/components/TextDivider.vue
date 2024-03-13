<template>
  <div class="d-flex align-center pt-6 pb-6 ml-4 mr-4">
    <v-divider />
    <p class="pl-5 pr-5 text-no-wrap">
      {{ text }}
    </p>
    <v-divider />
  </div>
</template>
<script setup lang="ts">
defineProps<{
  text: string
}>()
</script>
