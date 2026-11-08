<template>
  <div
    class="ingame-chat"
    :class="{ 'is-minimized': minimized }"
  >
    <div class="chat-header">
      <div v-if="!minimized">Chat</div>
      <button
        type="button"
        class="chat-toggle"
        :aria-label="minimized ? 'Maximize chat' : 'Minimize chat'"
        :aria-expanded="!minimized"
        aria-controls="ingame-chat-content"
        @click="minimized = !minimized"
      >
        {{ minimized ? '🗖' : '-' }}
      </button>
    </div>
    <div
      v-show="!minimized"
      id="ingame-chat-content"
    >
      <div
        ref="messagesEl"
        class="chat-messages"
      >
        <div
          v-for="(msg, idx) in messages"
          :key="idx"
          class="chat-message"
        >
          <span class="chat-message-name">{{ msg.playerName || 'Anonymous' }}</span>: {{ msg.text }}
        </div>
      </div>
      <v-select
        :model-value="null"
        :items="CHAT_MESSAGES"
        placeholder="Choose a message"
        aria-label="Choose a message"
        density="compact"
        variant="outlined"
        hide-details
        @update:model-value="send"
      />
    </div>
  </div>
</template>
<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { CHAT_MESSAGES } from '@common/GameCommon'
import type { ChatMessage } from '@common/Types'

const props = defineProps<{
  messages: ChatMessage[],
}>()

const emit = defineEmits<{
  (e: 'send', text: string): void
}>()

const messagesEl = ref<HTMLElement>()
const minimized = ref(false)

const send = (text: string | null): void => {
  if (text && CHAT_MESSAGES.includes(text)) {
    emit('send', text)
  }
}

watch([() => props.messages.length, minimized], async () => {
  if (minimized.value) return
  await nextTick()
  if (messagesEl.value) {
    messagesEl.value.scrollTop = messagesEl.value.scrollHeight
  }
})
</script>
