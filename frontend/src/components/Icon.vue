<template>
  <i
    class="icon"
    :class="classes"
  />
</template>
<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  icon?: string,
}>(), {
  icon: '',
})

const classes = computed(() => {
  if (props.icon) {
    return [`icon-${props.icon}`]
  }
  return []
})
</script>
