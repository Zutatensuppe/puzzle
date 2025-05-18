<template>
  <div
    v-if="messages.length"
    class="status-messages"
  >
    <div
      v-for="(msg,idx) in messages"
      :key="idx"
    >
      {{ msg }}
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue'

const messages = ref<string[]>([])

const buildMessage = (what: string, value: number | string | boolean | undefined): string => {
  if (typeof value === 'undefined') {
    return `${what}`
  }
  if (value === true || value === false) {
    return `${what} ${value ? 'enabled' : 'disabled'}`
  }

  return `${what} changed to ${value}`
}
const addMessage = (what: string, value: number | string | boolean | undefined): void => {
  messages.value.push(buildMessage(what, value))
  setTimeout(() => {
    messages.value.shift()
  }, 3000)
}

defineExpose({
  addMessage,
})
</script>
