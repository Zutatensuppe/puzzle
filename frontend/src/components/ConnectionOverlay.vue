<template>
  <v-dialog
    v-model="show"
    class="overlay-connection"
    :persistent="true"
  >
    <v-card>
      <v-container :fluid="true">
        <v-form
          v-if="hasServerError"
          class="justify-center mb-2"
        >
          <h4>Not possible to join :(</h4>

          <div
            v-if="connectionState.errorDetails?.gameDoesNotExist"
            class="mb-3"
          >
            The game you are trying to join does not exist.
          </div>
          <div
            v-else-if="connectionState.errorDetails?.banned"
            class="mb-3"
          >
            You were banned from this puzzle.
          </div>
          <div v-else>
            <div
              v-if="connectionState.errorDetails?.requireAccount"
              class="mb-3"
            >
              You need to be logged in to join this puzzle.

              <LoginBit />
            </div>
            <div
              v-if="connectionState.errorDetails?.requirePassword || connectionState.errorDetails?.wrongPassword"
              class="mb-3"
            >
              <div v-if="connectionState.errorDetails.requirePassword">
                You need a password to join this puzzle.
              </div>
              <div v-else>
                The password you provided is wrong.
              </div>

              <v-text-field
                ref="passwordField"
                v-model="joinPassword"
                hide-details
                type="password"
                density="compact"
                label="Password"
                autocomplete="game-password"
                @keydown.enter.prevent="connectWithPassword"
              />
            </div>

            <div
              class="d-flex justify-center mt-5"
            >
              <v-btn
                color="info"
                prepend-icon="mdi-wifi"
                @click="connectWithPassword"
              >
                Connect to puzzle
              </v-btn>
            </div>
          </div>
        </v-form>
        <div
          v-if="lostConnection"
          class="d-flex justify-center mb-2"
        >
          <h4>CONNECTION LOST</h4>
        </div>
        <div
          v-if="lostConnection"
          class="d-flex justify-center"
        >
          <v-btn
            color="info"
            prepend-icon="mdi-wifi"
            @click="emit('reconnect')"
          >
            Reconnect
          </v-btn>
        </div>
        <div
          v-if="connecting"
          class="d-flex justify-center"
        >
          Connecting...
        </div>
      </v-container>
    </v-card>
  </v-dialog>
</template>
<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { ConnectionState } from '@common/Types'
import LoginBit from './LoginBit.vue'
import { ConnectionStatesEnum } from '@common/Enums'

const emit = defineEmits<{
  (e: 'reconnect'): void
  (e: 'connect_with_password', password: string): void
  (e: 'close'): void
}>()

const props = defineProps<{
  connectionState: ConnectionState
}>()

const passwordField = ref<HTMLInputElement | null>(null)

const hasServerError = computed((): boolean => {
  return props.connectionState.state === ConnectionStatesEnum.SERVER_ERROR
})

const lostConnection = computed((): boolean => {
  return props.connectionState.state === ConnectionStatesEnum.DISCONNECTED
})

const connecting = computed((): boolean => {
  return props.connectionState.state === ConnectionStatesEnum.CONNECTING
})

const show = computed((): boolean => {
  return !!(lostConnection.value || connecting.value || hasServerError.value)
})

const joinPassword = ref<string>('')

const connectWithPassword = () => {
  emit('connect_with_password', joinPassword.value)
}

const tryFocusInput = () => {
  const err = props.connectionState.errorDetails
  if (err?.requirePassword || err?.wrongPassword) {
    void nextTick(() => {
      passwordField.value?.focus()
    })
  }
}

tryFocusInput()
watch(() => props.connectionState, () => {
  tryFocusInput()
}, { deep: true })
</script>
