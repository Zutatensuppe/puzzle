<template>
  <v-card class="report-player-dialog">
    <v-card-title>Report Player</v-card-title>

    <v-container :fluid="true">
      <v-text-field
        v-model="reason"
        placeholder="Optionally provide a reason for reporting this player"
        label="Reason"
      />

      <v-card-actions>
        <v-btn
          variant="elevated"
          color="success"
          prepend-icon="mdi-exclamation-thick"
          @click="onSubmitReport"
        >
          Submit Report
        </v-btn>
        <v-btn
          color="error"
          variant="elevated"
          @click="closeDialog"
        >
          Cancel
        </v-btn>
      </v-card-actions>
    </v-container>
  </v-card>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import { useDialog } from '../../useDialog'

const { reportPlayerId, submitReportPlayer, closeDialog } = useDialog()

const reason = ref<string>('')

const onSubmitReport = async () => {
  if (!reportPlayerId.value) return

  await submitReportPlayer({
    id: reportPlayerId.value,
    reason: reason.value,
  })
}
</script>
