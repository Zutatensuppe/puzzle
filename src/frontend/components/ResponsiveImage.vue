<template>
  <div :style="style" :title="title"></div>
</template>
<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  src: string
  title?: string
  height?: string
  width?: string
}>(), {
  title: '',
  height: '100%',
  width: '100%',
})

const style = computed(() => {
  return {
    display: 'inline-block',
    verticalAlign: 'text-bottom',
    backgroundImage: `url('${props.src}')`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: 'contain',
    backgroundPosition: 'center',
    width: props.width,
    height: props.height,
  }
})
</script>
