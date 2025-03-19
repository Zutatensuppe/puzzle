<template>
  <v-card class="report-game-dialog">
    <v-card-title>Report Game</v-card-title>

    <v-container :fluid="true">
      <v-text-field
        v-model="reason"
        placeholder="Optionally provide a reason for reporting this game"
        label="Reason"
      />

      <v-card-actions>
        <v-btn
          variant="elevated"
          color="success"
          prepend-icon="mdi-exclamation-thick"
          @click="submitReport"
        >
          Submit Report
        </v-btn>
        <v-btn
          color="error"
          variant="elevated"
          @click="emit('close')"
        >
          Cancel
        </v-btn>
      </v-card-actions>
    </v-container>
  </v-card>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue'
import { GameId, GameInfo } from '../../../common/src/Types'

const props = defineProps<{
  game: GameInfo
}>()

const emit = defineEmits<{
  (e: 'submit', val: { id: GameId, reason: string }): void
  (e: 'close'): void
}>()

const reason = ref<string>('')

const init = (_game: GameInfo) => {
  // nothing to do for now
}

const submitReport = () => {
  emit('submit', {
    id: props.game.id,
    reason: reason.value,
  })
}

init(props.game)
watch(() => props.game, (newValue) => {
  init(newValue)
})
</script>
